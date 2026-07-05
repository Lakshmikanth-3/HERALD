// HERALD — Briefs Routes with a real x402 Payment Gate
// GET /api/briefs             — list all briefs (metadata only, free)
// GET /api/briefs/:id/preview — teaser (free)
// GET /api/briefs/:id         — full brief (requires a real x402 X-PAYMENT header)
//
// Verification and settlement go through Circle's real Gateway facilitator
// (@circle-fin/x402-batching), the same SDK used by the hackathon's official
// reference implementation (github.com/circlefin/arc-nanopayments). An earlier
// version of this file called `https://api.circle.com/v1/payments/x402/verify`,
// which does not exist on Circle's API (confirmed 404) — this replaces it with
// BatchFacilitatorClient pointed at Circle's real testnet Gateway API.

import { Router, Request, Response } from 'express';
import { BatchFacilitatorClient } from '@circle-fin/x402-batching/server';
import { getAllBriefs, getBrief, incrementBriefRevenue, insertPayment } from '../../shared/db';
import { emit } from '../../shared/events';
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

// GET /api/briefs — list all briefs (public, no payment required)
router.get('/', (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10), 100);
  const briefs = getAllBriefs(limit);
  const metadata = briefs.map(b => ({
    id: b.id,
    title: b.title,
    topic: b.topic,
    confidence: b.confidence,
    sourcesCount: b.sources.length,
    productionCost: b.productionCost,
    priceUsd: b.priceUsd,
    publishedAt: b.publishedAt,
    revenue: b.revenue,
    purchases: b.purchases,
    keyFindingTeaser: b.keyFinding.slice(0, 120) + (b.keyFinding.length > 120 ? '...' : ''),
  }));
  res.json(metadata);
});

// GET /api/briefs/:id/preview — free teaser
router.get('/:id/preview', (req: Request, res: Response) => {
  const briefId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const brief = getBrief(briefId as string);
  if (!brief) { res.status(404).json({ error: 'Brief not found' }); return; }
  res.json({
    id: brief.id,
    title: brief.title,
    topic: brief.topic,
    confidence: brief.confidence,
    priceUsd: brief.priceUsd,
    publishedAt: brief.publishedAt,
    purchases: brief.purchases,
    revenue: brief.revenue,
    keyFindingTeaser: brief.keyFinding.slice(0, 150) + '...',
    sourcesCount: brief.sources.length,
    productionCost: brief.productionCost,
  });
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

// GET /api/briefs/:id — full brief, x402-gated
// Returns HTTP 402 with a Gateway-batched payment challenge if no valid
// X-PAYMENT header is present. Verifies and settles via Circle's real
// Gateway facilitator on Arc Testnet.
router.get('/:id', async (req: Request, res: Response) => {
  const briefId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const brief = getBrief(briefId as string);
  if (!brief) { res.status(404).json({ error: 'Brief not found' }); return; }

  const walletAddress = process.env.HERALD_WALLET_ADDRESS;
  if (!walletAddress) {
    res.status(503).json({
      error: 'Agent wallet not configured. Run: npm run provision:wallet then npm run seed:vault',
    });
    return;
  }

  let requirements: PaymentRequirements;
  try {
    requirements = buildPaymentRequirements(brief.priceUsd, walletAddress);
  } catch (err) {
    res.status(503).json({ error: (err as Error).message });
    return;
  }

  const paymentHeader = req.headers['x-payment'] as string | undefined;

  if (!paymentHeader) {
    res.status(402).json({
      error: 'Payment Required',
      x402Version: 2,
      resource: {
        url: `${req.protocol}://${req.get('host')}/api/briefs/${brief.id}`,
        description: `HERALD Research Brief: ${brief.title}`,
        mimeType: 'application/json',
      },
      accepts: [requirements],
    });
    return;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf-8')
    ) as { x402Version: number; payload: Record<string, unknown> };

    // BatchEvmScheme.createPaymentPayload only returns {x402Version, payload} —
    // resource/accepted are normally attached by the full x402Client wrapper,
    // which HERALD doesn't use (it hand-rolls the 402 retry). Reconstruct them
    // here from what we already generated for the 402 challenge, since Circle's
    // Gateway facilitator requires both fields to be present.
    const paymentPayload: PaymentPayload = {
      x402Version: decoded.x402Version,
      resource: {
        url: `${req.protocol}://${req.get('host')}/api/briefs/${brief.id}`,
        description: `HERALD Research Brief: ${brief.title}`,
        mimeType: 'application/json',
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
    incrementBriefRevenue(brief.id, brief.priceUsd);
    insertPayment({
      id: uuidv4(),
      type: 'received',
      briefId: brief.id,
      amountUsd: brief.priceUsd,
      source: buyerAddress,
      reason: `Brief "${brief.title.slice(0, 50)}" purchased (tx: ${settleResult.transaction})`,
      timestamp: Math.floor(Date.now() / 1000),
    });

    emit('payment:received', {
      briefId: brief.id,
      briefTitle: brief.title,
      amountUsd: brief.priceUsd,
      buyerAddress,
      transaction: settleResult.transaction,
    });

    res.json(brief);
  } catch (err) {
    res.status(500).json({ error: `Payment verification error: ${(err as Error).message}` });
  }
});

export default router;
