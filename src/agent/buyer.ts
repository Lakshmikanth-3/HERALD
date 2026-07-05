// HERALD — x402 Buyer / Source Fetcher
// Real x402 flow:
//   1. Fetch source → if 200, content is free (RSS feeds, public articles)
//   2. If 402 returned, read the Gateway-batched payment requirements
//   3. Sign a real EIP-712 authorization via Circle's Developer-Controlled
//      Wallet (agent/circleSign.ts) using @circle-fin/x402-batching's
//      BatchEvmScheme — the same client-side scheme the hackathon's official
//      reference implementation uses (github.com/circlefin/arc-nanopayments)
//   4. Retry the fetch with the X-PAYMENT header (signed auth payload)
//   5. Record the payment in DB and emit to the live feed
//
// Sources that don't respond with 402 are read for free and recorded as $0 cost.
// Sources that respond with 402 but aren't Circle Gateway-batched (extra.name
// !== "GatewayWalletBatched") are skipped — HERALD only knows how to pay via
// the real facilitator it has verified, not an assumed/guessed payment scheme.

import { BatchEvmScheme } from '@circle-fin/x402-batching/client';
import { emit } from '../shared/events';
import { markSourceSeen, insertPayment } from '../shared/db';
import { getCircleEvmSigner } from './circleSign';
import { GATEWAY_BATCHING_DOMAIN_NAME } from '../shared/chain';
import { v4 as uuidv4 } from 'uuid';
import type { ScoredSource } from '../shared/types';

export interface FetchedSource {
  url: string;
  title: string;
  content: string;
  paidUsd: number;
  wasX402: boolean;
}

interface PaymentRequirements {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

// Build a real x402 X-PAYMENT header by signing a genuine EIP-712
// GatewayWalletBatched authorization via Circle's Developer-Controlled Wallet.
async function buildX402PaymentHeader(requirements: PaymentRequirements): Promise<string | null> {
  try {
    const signer = await getCircleEvmSigner();
    const scheme = new BatchEvmScheme(signer);
    const { x402Version, payload } = await scheme.createPaymentPayload(2, requirements);
    return Buffer.from(JSON.stringify({ x402Version, payload })).toString('base64');
  } catch (err) {
    console.error('[buyer] Failed to build x402 payment header:', (err as Error).message);
    return null;
  }
}

export async function fetchSource(
  source: ScoredSource,
  sessionBudgetRemaining: number
): Promise<FetchedSource | null> {
  markSourceSeen(source.url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(source.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'HERALD-Agent/1.0 (+https://herald.agent)' },
      });
    } finally {
      clearTimeout(timeout);
    }

    // ── x402 Payment Required ─────────────────────────────────────────────────
    if (response.status === 402) {
      // Parse the x402 response body to get Gateway-batched payment requirements
      let paymentDetails: { accepts?: PaymentRequirements[] } = {};

      try {
        paymentDetails = await response.json();
      } catch {
        // Some sources return WWW-Authenticate header instead
      }

      const requirements = paymentDetails.accepts?.find(
        a => a.extra?.name === GATEWAY_BATCHING_DOMAIN_NAME
      );

      if (!requirements) {
        const reason = 'x402: source does not offer a Circle Gateway-batched payment option HERALD can pay';
        emit('payment:skipped', { url: source.url, domain: source.domain, reason });
        insertPayment({ id: uuidv4(), type: 'skipped', url: source.url, amountUsd: 0, destination: source.domain, reason, timestamp: Math.floor(Date.now() / 1000) });
        return null;
      }

      const payAmount = parseFloat(requirements.amount) / 1_000_000; // USDC has 6 decimals

      if (payAmount > source.maxPayUsd) {
        const reason = `Source demands $${payAmount.toFixed(4)} but agent max is $${source.maxPayUsd.toFixed(4)}`;
        emit('payment:skipped', { url: source.url, domain: source.domain, reason, score: source.relevanceScore });
        insertPayment({ id: uuidv4(), type: 'skipped', url: source.url, amountUsd: 0, destination: source.domain, reason, timestamp: Math.floor(Date.now() / 1000) });
        return null;
      }

      if (payAmount > sessionBudgetRemaining) {
        const reason = `Session budget exhausted. Needed $${payAmount.toFixed(4)}, remaining $${sessionBudgetRemaining.toFixed(4)}`;
        emit('payment:skipped', { url: source.url, domain: source.domain, reason });
        insertPayment({ id: uuidv4(), type: 'skipped', url: source.url, amountUsd: 0, destination: source.domain, reason, timestamp: Math.floor(Date.now() / 1000) });
        return null;
      }

      // Build a real signed Gateway-batched authorization via Circle's API
      const paymentHeader = await buildX402PaymentHeader(requirements);
      if (!paymentHeader) {
        const reason = 'x402: failed to build payment authorization (Circle signing error)';
        emit('payment:skipped', { url: source.url, domain: source.domain, reason });
        insertPayment({ id: uuidv4(), type: 'skipped', url: source.url, amountUsd: 0, destination: source.domain, reason, timestamp: Math.floor(Date.now() / 1000) });
        return null;
      }

      // Retry with real X-PAYMENT header (x402 spec)
      const payResponse = await fetch(source.url, {
        headers: {
          'User-Agent': 'HERALD-Agent/1.0',
          'X-PAYMENT': paymentHeader,
        },
      });

      if (!payResponse.ok) {
        const reason = `x402 payment rejected by source: HTTP ${payResponse.status}`;
        emit('payment:skipped', { url: source.url, domain: source.domain, reason });
        insertPayment({ id: uuidv4(), type: 'skipped', url: source.url, amountUsd: 0, destination: source.domain, reason, timestamp: Math.floor(Date.now() / 1000) });
        return null;
      }

      const content = await payResponse.text();

      insertPayment({
        id: uuidv4(),
        type: 'sent',
        url: source.url,
        amountUsd: payAmount,
        destination: source.domain,
        reason: `x402 paid for: "${source.title.slice(0, 60)}"`,
        timestamp: Math.floor(Date.now() / 1000),
      });
      markSourceSeen(source.url, payAmount);

      emit('payment:sent', {
        url: source.url,
        domain: source.domain,
        title: source.title.slice(0, 80),
        amountUsd: payAmount,
        wasX402: true,
      });

      return { url: source.url, title: source.title, content: stripHtml(content).slice(0, 5000), paidUsd: payAmount, wasX402: true };
    }

    // ── Non-x402 source (200 OK) ──────────────────────────────────────────────
    if (!response.ok) {
      const reason = `HTTP ${response.status} from ${source.domain}`;
      emit('payment:skipped', { url: source.url, domain: source.domain, reason, score: source.relevanceScore });
      return null;
    }

    const rawContent = await response.text();
    const textContent = stripHtml(rawContent).slice(0, 5000);

    insertPayment({
      id: uuidv4(),
      type: 'sent',
      url: source.url,
      amountUsd: 0,
      destination: source.domain,
      reason: `Free read: "${source.title.slice(0, 60)}"`,
      timestamp: Math.floor(Date.now() / 1000),
    });

    emit('payment:sent', {
      url: source.url,
      domain: source.domain,
      title: source.title.slice(0, 80),
      amountUsd: 0,
      wasX402: false,
      relevanceScore: source.relevanceScore.toFixed(2),
    });

    return { url: source.url, title: source.title, content: textContent, paidUsd: 0, wasX402: false };

  } catch (err) {
    const reason = `Fetch error: ${(err as Error).message}`;
    emit('payment:skipped', { url: source.url, domain: source.domain, reason });
    insertPayment({ id: uuidv4(), type: 'skipped', url: source.url, amountUsd: 0, destination: source.domain, reason, timestamp: Math.floor(Date.now() / 1000) });
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
