// HERALD — Circle Agent Wallet Operations
// Uses Circle Programmable Wallets API directly (no CLI dependency at runtime)

import { getCircleApiKey, getHeraldWalletId, getHeraldWalletAddress } from './secrets';
import { emit } from '../shared/events';

// Verified live 2026-07-04: Circle's wallet-balances endpoint is under /v1/w3s/,
// not /v1/ as previously called here (that path 404s — "Resource not found").
const CIRCLE_BASE = 'https://api.circle.com/v1/w3s';

async function circleRequest(
  method: string,
  path: string,
  body?: object
): Promise<Record<string, unknown>> {
  const apiKey = await getCircleApiKey();
  const requestInit: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  };

  // Retry once on a transient network-level failure (undici "fetch failed" —
  // observed in practice against long-running processes). Non-2xx HTTP
  // responses are real answers and are not retried here.
  let res: Response;
  try {
    res = await fetch(`${CIRCLE_BASE}${path}`, requestInit);
  } catch {
    res = await fetch(`${CIRCLE_BASE}${path}`, requestInit);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Circle API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

export interface WalletBalance {
  walletId: string;
  address: string;
  usdcBalance: number;
  rawBalances: Array<{ amount: string; token: { symbol: string } }>;
}

export async function getAgentBalance(): Promise<WalletBalance> {
  const walletId = await getHeraldWalletId();
  const address = await getHeraldWalletAddress();
  const data = await circleRequest('GET', `/wallets/${walletId}/balances`);
  const balances = (data.data as { tokenBalances?: Array<{ amount: string; token: { symbol: string } }> })?.tokenBalances ?? [];
  const usdcEntry = balances.find(b => b.token.symbol === 'USDC' || b.token.symbol === 'USDC-E');
  const usdcBalance = parseFloat(usdcEntry?.amount ?? '0');

  return {
    walletId,
    address,
    usdcBalance,
    rawBalances: balances,
  };
}

export async function checkSufficientBalance(sessionBudgetUsd: number): Promise<boolean> {
  // Real balance check — no fallback. If the wallet is not configured,
  // the agent STOPS. This enforces economic accountability.
  const { usdcBalance } = await getAgentBalance();
  const required = sessionBudgetUsd * 1.1; // 10% buffer
  if (usdcBalance < required) {
    emit('agent:low-balance', {
      balance: usdcBalance,
      required,
      message: `Balance $${usdcBalance.toFixed(4)} is below required $${required.toFixed(4)}. Fund wallet to continue.`,
    });
    return false;
  }
  return true;
}
