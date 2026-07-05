// HERALD — Agent Routes
// GET  /api/agent/status       — current agent state
// GET  /api/agent/balance      — live Circle wallet balance
// GET  /api/agent/economy-feed — SSE stream of all agent events
// GET  /api/agent/payments     — recent payment history
// POST /api/agent/run          — manually trigger one agent cycle
// POST /api/agent/pay          — execute a real x402 payment from the agent wallet
//                                and return the signed X-PAYMENT header
// POST /api/agent/deposit      — deposit USDC into Circle Gateway (real on-chain
//                                approve + deposit) so the agent can spend via
//                                Gateway-batched x402 payments

import { Router, Request, Response } from 'express';
import { runAgentCycle, isAgentRunning } from '../../agent/index';
import { getAgentBalance } from '../../agent/wallet';
import { getHeraldWalletAddress } from '../../agent/secrets';
import { getCircleEvmSigner } from '../../agent/circleSign';
import { depositToGateway } from '../../agent/gateway';
import { BatchEvmScheme } from '@circle-fin/x402-batching/client';
import { getRecentPayments, getDailyBalance, getConfig, insertPayment, getFeedHistory } from '../../shared/db';
import { emit, eventBus } from '../../shared/events';
import type { EconomyEvent } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/agent/status
router.get('/status', (req: Request, res: Response) => {
  const topic = getConfig('topic');
  const weeklyBudget = getConfig('weeklyBudget');
  const daily = getDailyBalance();
  res.json({
    configured: !!topic,
    isRunning: isAgentRunning(),
    topic,
    weeklyBudget: parseFloat(weeklyBudget ?? '0'),
    briefPrice: parseFloat(getConfig('briefPrice') ?? '0.05'),
    agentId: process.env.ONECLAW_AGENT_ID ?? null,
    walletAddress: process.env.HERALD_WALLET_ADDRESS ?? null,
    daily,
  });
});

// GET /api/agent/balance
router.get('/balance', async (req: Request, res: Response) => {
  try {
    const balance = await getAgentBalance();
    const daily = getDailyBalance();
    res.json({ ...balance, ...daily });
  } catch (err) {
    res.status(503).json({ error: (err as Error).message });
  }
});

// GET /api/agent/economy-feed — Server-Sent Events stream
router.get('/economy-feed', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  res.write(': connected\n\n');

  const handler = (event: EconomyEvent) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  eventBus.on('*', handler);

  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(pingInterval);
    eventBus.off('*', handler);
  });
});

// GET /api/agent/payments — recent payment history
router.get('/payments', (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10), 100);
  const payments = getRecentPayments(limit);
  res.json(payments);
});

// GET /api/agent/feed-history — past DB-persisted payment/skip/publish events,
// shaped exactly like EconomyEvent, so the Economy page's Live Feed and
// FlowGraph never look dead on a fresh load (before any live SSE event fires).
router.get('/feed-history', (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10), 200);
  res.json(getFeedHistory(limit));
});

// POST /api/agent/run — manual cycle trigger
router.post('/run', async (req: Request, res: Response) => {
  if (isAgentRunning()) {
    res.status(409).json({ error: 'Agent is already running' });
    return;
  }
  res.json({ message: 'Agent cycle started' });
  runAgentCycle().catch(err => console.error('[manual run] Error:', err.message));
});

// POST /api/agent/pay
// Executes a real x402 payment from the HERALD agent wallet.
// Called by the Library screen when a user wants to purchase a brief.
// Steps:
//   1. Calls Circle signing API to generate a real EIP-3009 authorization
//   2. Returns the base64-encoded X-PAYMENT header for the client to use
interface PaymentRequirements {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

router.post('/pay', async (req: Request, res: Response) => {
  const { briefId, priceUsd, challenge } = req.body as {
    briefId: string;
    priceUsd: number;
    challenge: { accepts?: PaymentRequirements[] };
  };

  if (!briefId || !priceUsd || !challenge) {
    res.status(400).json({ error: 'briefId, priceUsd, and challenge are required' });
    return;
  }

  const requirements = challenge.accepts?.[0];
  if (!requirements) {
    res.status(400).json({ error: 'No payment requirements in x402 challenge' });
    return;
  }

  try {
    const walletAddress = await getHeraldWalletAddress();

    // Sign a real Gateway-batched EIP-712 authorization via Circle's
    // Developer-Controlled Wallets API (see agent/circleSign.ts), using the
    // same BatchEvmScheme the hackathon's reference implementation uses.
    const signer = await getCircleEvmSigner();
    const scheme = new BatchEvmScheme(signer);
    const { x402Version, payload } = await scheme.createPaymentPayload(2, requirements);
    const xPaymentHeader = Buffer.from(JSON.stringify({ x402Version, payload })).toString('base64');

    // Record the outgoing payment in our DB
    insertPayment({
      id: uuidv4(),
      type: 'sent',
      briefId,
      url: `herald://briefs/${briefId}`,
      amountUsd: priceUsd,
      destination: requirements.payTo,
      reason: `x402 brief purchase: ${briefId}`,
      timestamp: Math.floor(Date.now() / 1000),
    });

    emit('payment:sent', {
      briefId,
      domain: requirements.payTo.slice(0, 10) + '…',
      amountUsd: priceUsd,
      wasX402: true,
      title: `Brief purchase`,
    });

    res.json({ xPaymentHeader, payerAddress: walletAddress });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/agent/deposit
// Deposits USDC into Circle Gateway via two real on-chain transactions
// (ERC20 approve + GatewayWallet.deposit). Required before the agent can
// spend anything through the Gateway-batched x402 flow (see agent/gateway.ts).
router.post('/deposit', async (req: Request, res: Response) => {
  const { amountUsd } = req.body as { amountUsd?: number };

  if (typeof amountUsd !== 'number' || amountUsd <= 0) {
    res.status(400).json({ error: 'amountUsd must be a positive number' });
    return;
  }

  try {
    const result = await depositToGateway(amountUsd);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
