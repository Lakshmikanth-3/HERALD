// HERALD — Sources Routes: real x402-gated original content
// GET /api/sources           — list all paid sources (metadata only, free)
// GET /api/sources/:id       — full content, x402-gated
//
// This closes the buy-side loop for real. buyer.ts only ever pays a source
// that actually responds HTTP 402 with a Gateway-batched offer — the public
// RSS feeds in discover.ts never do that, so without this route the buy-side
// payment code path never fires. These are genuine, originally-authored short
// research notes HERALD hosts and charges to read, settled via the same
// Circle Gateway facilitator used on the sell side (routes/briefs.ts) to a
// *separate* treasury wallet (HERALD_SOURCES_WALLET_ADDRESS) — so the agent
// is paying a different party, not moving money to itself.

import { Router, Request, Response } from 'express';
import { BatchFacilitatorClient } from '@circle-fin/x402-batching/server';
import { getAllPaidSources, getPaidSource, incrementPaidSourceRevenue, insertPayment } from '../../shared/db';
import {
  X402_NETWORK,
  GATEWAY_API_TESTNET_URL,
  GATEWAY_WALLET_ADDRESS,
  GATEWAY_BATCHING_DOMAIN_NAME,
  GATEWAY_BATCHING_DOMAIN_VERSION,
  getUsdcTokenAddress,
} from '../../shared/chain';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const facilitator = new BatchFacilitatorClient({ url: GATEWAY_API_TESTNET_URL });

interface PaymentRequirements {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

interface PaymentPayload {
  x402Version: number;
  resource: { url: string; description: string; mimeType: string };
  accepted: Record<string, unknown>;
  payload: Record<string, unknown>;
}

// GET /api/sources — list all paid sources (public metadata, free)
router.get('/', (_req: Request, res: Response) => {
  const sources = getAllPaidSources();
  res.json(sources.map(s => ({
    id: s.id,
    title: s.title,
    domain: s.domain,
    priceUsd: s.priceUsd,
    wordCount: s.wordCount,
    publishedAt: s.publishedAt,
    revenue: s.revenue,
    purchases: s.purchases,
  })));
});

function buildPaymentRequirements(priceUsd: number, payTo: string): PaymentRequirements {
  return {
    scheme: 'exact',
    network: X402_NETWORK,
    asset: getUsdcTokenAddress(),
    amount: String(Math.ceil(priceUsd * 1_000_000)), // USDC has 6 decimals
    payTo,
    maxTimeoutSeconds: 300,
    extra: {
      name: GATEWAY_BATCHING_DOMAIN_NAME,
      version: GATEWAY_BATCHING_DOMAIN_VERSION,
      verifyingContract: GATEWAY_WALLET_ADDRESS,
    },
  };
}

// GET /api/sources/:id — full content, x402-gated
// Returns HTTP 402 with a Gateway-batched payment challenge if no valid
// X-PAYMENT header is present. Verifies and settles via Circle's real
// Gateway facilitator on Arc Testnet — identical verification path to
// routes/briefs.ts, but the payTo is the sources treasury wallet.
router.get('/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const source = getPaidSource(id as string);
  if (!source) { res.status(404).json({ error: 'Source not found' }); return; }

  const treasuryAddress = process.env.HERALD_SOURCES_WALLET_ADDRESS;
  if (!treasuryAddress) {
    res.status(503).json({
      error: 'Sources treasury wallet not configured. Run: npm run provision:sources-wallet',
    });
    return;
  }

  let requirements: PaymentRequirements;
  try {
    requirements = buildPaymentRequirements(source.priceUsd, treasuryAddress);
  } catch (err) {
    res.status(503).json({ error: (err as Error).message });
    return;
  }

  const resourceUrl = `${req.protocol}://${req.get('host')}/api/sources/${source.id}`;
  const paymentHeader = req.headers['x-payment'] as string | undefined;

  if (!paymentHeader) {
    res.status(402).json({
      error: 'Payment Required',
      x402Version: 2,
      resource: {
        url: resourceUrl,
        description: `HERALD Source: ${source.title}`,
        mimeType: 'text/plain',
      },
      accepts: [requirements],
    });
    return;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf-8')
    ) as { x402Version: number; payload: Record<string, unknown> };

    // See routes/briefs.ts for why resource/accepted are reconstructed here
    // rather than round-tripped from the client: BatchEvmScheme.createPaymentPayload
    // only returns {x402Version, payload}, but Circle's facilitator requires both.
    const paymentPayload: PaymentPayload = {
      x402Version: decoded.x402Version,
      resource: {
        url: resourceUrl,
        description: `HERALD Source: ${source.title}`,
        mimeType: 'text/plain',
      },
      accepted: requirements as unknown as Record<string, unknown>,
      payload: decoded.payload,
    };

    const verifyResult = await facilitator.verify(paymentPayload, requirements);
    if (!verifyResult.isValid) {
      res.status(402).json({ error: `Payment verification failed: ${verifyResult.invalidReason}` });
      return;
    }

    const settleResult = await facilitator.settle(paymentPayload, requirements);
    if (!settleResult.success) {
      res.status(402).json({ error: `Payment settlement failed: ${settleResult.errorReason}` });
      return;
    }

    const buyerAddress = settleResult.payer ?? verifyResult.payer ?? 'unknown';
    incrementPaidSourceRevenue(source.id, source.priceUsd);

    // Logged as 'source_sale', not 'received' — this is revenue to the
    // sources treasury (a separate actor), not the agent's own earnings, so
    // it must not inflate the agent's own daily P&L (getDailyBalance only
    // sums 'sent'/'received').
    insertPayment({
      id: uuidv4(),
      type: 'source_sale',
      url: resourceUrl,
      amountUsd: source.priceUsd,
      source: buyerAddress,
      reason: `Source "${source.title.slice(0, 50)}" purchased (tx: ${settleResult.transaction})`,
      timestamp: Math.floor(Date.now() / 1000),
    });

    res.type('text/plain').send(source.content);
  } catch (err) {
    res.status(500).json({ error: `Payment verification error: ${(err as Error).message}` });
  }
});

export default router;
