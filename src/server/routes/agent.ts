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
import { getRecentPayments, getDailyBalance, getConfig, insertPayment, getFeedHistory, getNetworkStats, getRecentCycleReports } from '../../shared/db';
import { buyBriefAsDemoWallet } from '../../agent/demoBuyer';
import { withdrawEarnings } from '../../agent/withdraw';
import { emit, eventBus } from '../../shared/events';
import type { EconomyEvent } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { ARC_TESTNET_CHAIN_ID, X402_NETWORK, GATEWAY_WALLET_ADDRESS, getUsdcTokenAddress } from '../../shared/chain';

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

// GET /api/agent/cycles — real per-cycle history (one row per run, whatever
// its outcome), for the Economy page's expandable cycle report cards.
router.get('/cycles', (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10), 100);
  res.json(getRecentCycleReports(limit));
});

// GET /api/agent/network-stats — public, all-time aggregates for the
// no-auth /network dashboard. Every figure is a real SUM/COUNT, no estimates.
router.get('/network-stats', (req: Request, res: Response) => {
  res.json(getNetworkStats());
});

// GET /api/agent/chain-info — public, non-secret contract + wallet addresses,
// for the UI's "verify it's real" links (Arc testnet explorer). None of this
// is sensitive: wallet addresses and contract addresses are public on-chain
// data, not credentials.
router.get('/chain-info', (req: Request, res: Response) => {
  let usdcAddress: string | null = null;
  try {
    usdcAddress = getUsdcTokenAddress();
  } catch {
    // Not configured yet — omit rather than fail the whole response.
  }
  res.json({
    network: X402_NETWORK,
    chainId: ARC_TESTNET_CHAIN_ID,
    explorerBase: 'https://testnet.arcscan.app',
    usdcContractAddress: usdcAddress,
    gatewayWalletContractAddress: GATEWAY_WALLET_ADDRESS,
    agentWalletAddress: process.env.HERALD_WALLET_ADDRESS ?? null,
    sourcesWalletAddress: process.env.HERALD_SOURCES_WALLET_ADDRESS ?? null,
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

// POST /api/agent/demo-buy
// Buys a live brief for real, paid from a separate "demo buyer wallet"
// (src/agent/demoBuyer.ts) rather than the agent's own wallet. In this
// single-instance deployment every brief in the Library is the agent's own,
// and Circle's Gateway facilitator correctly rejects a wallet paying itself
// as `self_transfer` — so this is what makes the "Buy" button in the UI
// actually complete a real x402 purchase instead of always failing.
router.post('/demo-buy', async (req: Request, res: Response) => {
  const { briefId } = req.body as { briefId?: string };
  if (!briefId) {
    res.status(400).json({ error: 'briefId is required' });
    return;
  }

  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${process.env.HERALD_API_PORT ?? '3001'}`;
    const result = await buyBriefAsDemoWallet(briefId, apiBase);
    res.json(result);
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

    // depositTxHash is a real EVM tx hash (unlike Gateway's x402 settle()
    // response, which returns a batch/settlement id) — persist and emit it
    // so the UI can link straight to a verifiable on-chain transaction.
    if (result.depositTxHash) {
      insertPayment({
        id: uuidv4(),
        type: 'deposit',
        amountUsd,
        reason: `Deposited $${amountUsd.toFixed(2)} USDC into Circle Gateway (approve tx: ${result.approvalTxHash ?? 'n/a'})`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash: result.depositTxHash,
      });
      emit('agent:deposit', {
        amountUsd,
        depositTxHash: result.depositTxHash,
        approvalTxHash: result.approvalTxHash,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/agent/withdraw
// Real on-chain USDC transfer out of the agent wallet to a destination the
// user supplies (see agent/withdraw.ts). This is the agent's own raw wallet
// balance, not its Circle Gateway balance — the two are separate (see
// agent/gateway.ts's header comment), so this doesn't touch funds already
// deposited into Gateway for x402 spending.
router.post('/withdraw', async (req: Request, res: Response) => {
  const { amountUsd, destinationAddress } = req.body as { amountUsd?: number; destinationAddress?: string };

  if (typeof amountUsd !== 'number' || amountUsd <= 0) {
    res.status(400).json({ error: 'amountUsd must be a positive number' });
    return;
  }
  if (!destinationAddress || !/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
    res.status(400).json({ error: 'destinationAddress must be a valid EVM address' });
    return;
  }

  try {
    const balance = await getAgentBalance();
    if (amountUsd > balance.usdcBalance) {
      res.status(400).json({ error: `Insufficient balance: wallet holds $${balance.usdcBalance.toFixed(4)}, requested $${amountUsd.toFixed(4)}` });
      return;
    }

    const result = await withdrawEarnings(amountUsd, destinationAddress);

    insertPayment({
      id: uuidv4(),
      type: 'withdrawal',
      amountUsd,
      destination: destinationAddress,
      reason: `Withdrew $${amountUsd.toFixed(4)} USDC to ${destinationAddress}`,
      timestamp: Math.floor(Date.now() / 1000),
      txHash: result.txHash,
    });
    emit('agent:withdrawal', {
      amountUsd,
      destinationAddress,
      txHash: result.txHash,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
