// HERALD — Agent-to-agent purchase
//
// Before running its own discover -> score -> pay -> synthesize loop, the
// agent checks the marketplace for an already-published brief — from another
// agent — that's relevant enough to buy and fold into its own synthesis
// instead of researching from scratch.
//
// Real, documented limitation: this deployment runs a single HERALD instance,
// and GET /api/marketplace lists only THIS instance's own SQLite briefs —
// there's no shared, cross-instance marketplace backend, and marketplace
// listings don't even carry a remote API base URL to buy from one. Every
// candidate below therefore shares this agent's own wallet address, and is
// correctly filtered out rather than faked as a cross-agent purchase —
// Circle's Gateway facilitator would (correctly) reject a same-wallet
// payment as `self_transfer` anyway (see scripts/test-third-party-purchase.ts).
// The scoring and purchase code path is otherwise real and would complete a
// genuine purchase the moment this ran against a truly separate agent's
// marketplace.

import { BatchEvmScheme } from '@circle-fin/x402-batching/client';
import { emit } from '../shared/events';
import { insertPayment, wasSeenRecently, markSourceSeen } from '../shared/db';
import { getHeraldWalletAddress } from './secrets';
import { getCircleEvmSigner } from './circleSign';
import { GATEWAY_BATCHING_DOMAIN_NAME } from '../shared/chain';
import { v4 as uuidv4 } from 'uuid';

const RELEVANCE_THRESHOLD = 0.7;
const MAX_BUDGET_SHARE = 0.5; // never spend more than half the remaining session budget on one brief

interface MarketplaceBriefListing {
  id: string;
  title: string;
  topic: string;
  agentId: string;
  agentAddress: string;
  sourcesCount: number;
  priceUsd: number;
  purchases: number;
  publishedAt: number;
  confidence: string;
  keyFindingTeaser: string;
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

function relevanceScore(topic: string, candidateTopic: string, teaser: string): number {
  const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (topicWords.length === 0) return 0;
  const text = (candidateTopic + ' ' + teaser).toLowerCase();
  const matches = topicWords.filter(w => text.includes(w));
  return matches.length / topicWords.length;
}

export interface BoughtMarketplaceBrief {
  id: string;
  title: string;
  keyFinding: string;
  supportingPoints: string[];
  sources: Array<{ url: string; title: string; cost: number }>;
  priceUsd: number;
}

// Checks the marketplace for a relevant brief from another agent and buys it
// with a real x402 payment if one clears the relevance and budget bars.
// Returns null (with an honest reason logged/emitted) if nothing qualifies —
// including the self-exclusion case documented above.
export async function tryBuyRelevantBrief(
  topic: string,
  budgetRemainingUsd: number,
  apiBase: string
): Promise<BoughtMarketplaceBrief | null> {
  let listings: MarketplaceBriefListing[];
  try {
    const res = await fetch(`${apiBase}/api/marketplace?limit=20`);
    if (!res.ok) return null;
    listings = await res.json();
  } catch (err) {
    console.warn(`[agent-to-agent] marketplace unavailable: ${(err as Error).message}`);
    return null;
  }

  const ownAddress = await getHeraldWalletAddress();
  const maxSpend = budgetRemainingUsd * MAX_BUDGET_SHARE;

  const candidates = listings
    .filter(b => {
      if (b.agentAddress.toLowerCase() === ownAddress.toLowerCase()) return false; // see module doc
      if (wasSeenRecently(`herald-marketplace://${b.id}`, 24)) return false;
      if (b.priceUsd > maxSpend) return false;
      return relevanceScore(topic, b.topic, b.keyFindingTeaser) >= RELEVANCE_THRESHOLD;
    })
    .sort((a, b) => relevanceScore(topic, b.topic, b.keyFindingTeaser) - relevanceScore(topic, a.topic, a.keyFindingTeaser));

  if (candidates.length === 0) {
    emit('discovery:skipped', {
      topic,
      reason: 'No other agent has a marketplace brief relevant enough (or affordable enough) to buy this cycle.',
      candidatesScanned: listings.length,
    });
    return null;
  }

  const target = candidates[0];
  markSourceSeen(`herald-marketplace://${target.id}`);

  try {
    const challengeRes = await fetch(`${apiBase}/api/briefs/${target.id}`);
    if (challengeRes.status !== 402) {
      emit('discovery:skipped', { topic, briefId: target.id, reason: `Expected a 402 challenge, got HTTP ${challengeRes.status}` });
      return null;
    }
    const challenge = await challengeRes.json() as { accepts: PaymentRequirements[] };
    const requirements = challenge.accepts.find(a => a.extra?.name === GATEWAY_BATCHING_DOMAIN_NAME);
    if (!requirements) {
      emit('discovery:skipped', { topic, briefId: target.id, reason: 'Marketplace brief does not offer a Circle Gateway-batched payment option' });
      return null;
    }

    const signer = await getCircleEvmSigner();
    const scheme = new BatchEvmScheme(signer);
    const { x402Version, payload } = await scheme.createPaymentPayload(2, requirements);
    const xPaymentHeader = Buffer.from(JSON.stringify({ x402Version, payload })).toString('base64');

    const unlockRes = await fetch(`${apiBase}/api/briefs/${target.id}`, { headers: { 'X-PAYMENT': xPaymentHeader } });
    const body = await unlockRes.json();

    if (!unlockRes.ok) {
      // Expected outcome in this single-instance deployment: Circle correctly
      // rejects the same-wallet payment as self_transfer.
      emit('discovery:skipped', { topic, briefId: target.id, reason: body.error ?? `Purchase failed: HTTP ${unlockRes.status}` });
      return null;
    }

    let txHash: string | undefined;
    const paymentResponseHeader = unlockRes.headers.get('x-payment-response');
    if (paymentResponseHeader) {
      try {
        const decoded = JSON.parse(Buffer.from(paymentResponseHeader, 'base64').toString('utf-8')) as { transaction?: string };
        txHash = decoded.transaction;
      } catch { /* not fatal */ }
    }

    insertPayment({
      id: uuidv4(),
      type: 'sent',
      briefId: target.id,
      amountUsd: target.priceUsd,
      destination: target.agentAddress,
      reason: `Bought marketplace brief from another agent: "${target.title.slice(0, 50)}"`,
      timestamp: Math.floor(Date.now() / 1000),
      txHash,
    });

    emit('discovery:bought', {
      briefId: target.id,
      title: target.title,
      amountUsd: target.priceUsd,
      sellerAddress: target.agentAddress,
      txHash,
    });

    return {
      id: body.id,
      title: body.title,
      keyFinding: body.keyFinding,
      supportingPoints: body.supportingPoints,
      sources: body.sources,
      priceUsd: target.priceUsd,
    };
  } catch (err) {
    emit('discovery:skipped', { topic, briefId: target.id, reason: (err as Error).message });
    return null;
  }
}
