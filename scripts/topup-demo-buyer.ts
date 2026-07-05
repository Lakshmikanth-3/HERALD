// HERALD — Top up the demo buyer wallet's Circle Gateway balance.
// The wallet itself is provisioned lazily on first use (src/agent/demoBuyer.ts)
// with a modest starting deposit meant for a handful of purchases. Heavy
// testing/demoing depletes it; this re-funds the existing wallet (does not
// create a new one) with a real on-chain transfer + Gateway deposit.
//
// Usage: npx tsx scripts/topup-demo-buyer.ts [usdcAmount]  (default 2.0)

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { buildEntitySecretCiphertext, CIRCLE_BASE } from '../src/agent/circleEntitySecret';
import { getUsdcTokenAddress, GATEWAY_WALLET_ADDRESS } from '../src/shared/chain';

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY!;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET!;
const AGENT_WALLET_ID = process.env.HERALD_WALLET_ID!;

const TERMINAL_SUCCESS = new Set(['COMPLETE', 'CONFIRMED']);
const TERMINAL_FAILURE = new Set(['FAILED', 'DENIED', 'CANCELLED']);

async function waitForTransaction(id: string, timeoutMs = 90000): Promise<{ state: string; txHash?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${CIRCLE_BASE}/v1/w3s/transactions/${id}`, {
      headers: { Authorization: `Bearer ${CIRCLE_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Failed to poll transaction ${id}: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { data: { transaction: { state: string; txHash?: string } } };
    const { state, txHash } = data.data.transaction;
    if (TERMINAL_SUCCESS.has(state)) return { state, txHash };
    if (TERMINAL_FAILURE.has(state)) throw new Error(`Transaction ${id} ended in state ${state}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Transaction ${id} did not reach a terminal state within ${timeoutMs}ms`);
}

async function executeContractCall(walletId: string, contractAddress: string, abiFunctionSignature: string, abiParameters: string[]): Promise<{ id: string }> {
  const entitySecretCiphertext = await buildEntitySecretCiphertext(CIRCLE_API_KEY);
  const res = await fetch(`${CIRCLE_BASE}/v1/w3s/developer/transactions/contractExecution`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CIRCLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      walletId, contractAddress, abiFunctionSignature, abiParameters,
      entitySecretCiphertext, feeLevel: 'MEDIUM',
    }),
  });
  if (!res.ok) throw new Error(`Circle contractExecution failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { data: { id: string } };
  return { id: data.data.id };
}

async function main() {
  const amountUsd = parseFloat(process.argv[2] ?? '2.0');
  if (!CIRCLE_API_KEY || !ENTITY_SECRET || !AGENT_WALLET_ID) {
    console.error('Missing CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, or HERALD_WALLET_ID in .env.local');
    process.exit(1);
  }

  const db = new Database(path.join(process.cwd(), 'data', 'herald.db'));
  const row = db.prepare(`SELECT value FROM agent_config WHERE key = 'demoBuyerWalletId'`).get() as { value: string } | undefined;
  const addrRow = db.prepare(`SELECT value FROM agent_config WHERE key = 'demoBuyerWalletAddress'`).get() as { value: string } | undefined;
  if (!row || !addrRow) {
    console.error('No demo buyer wallet provisioned yet — it provisions itself lazily on first use (src/agent/demoBuyer.ts), nothing to top up.');
    process.exit(1);
  }
  const demoWalletId = row.value;
  const demoWalletAddress = addrRow.value;

  console.log(`Topping up demo buyer wallet ${demoWalletAddress} by $${amountUsd.toFixed(2)} USDC...\n`);

  const client = initiateDeveloperControlledWalletsClient({ apiKey: CIRCLE_API_KEY, entitySecret: ENTITY_SECRET });
  const usdcAddress = getUsdcTokenAddress();

  console.log('1. Transferring from the agent wallet (real on-chain transfer)...');
  const transferRes = await client.createTransaction({
    walletId: AGENT_WALLET_ID,
    tokenAddress: usdcAddress,
    blockchain: 'ARC-TESTNET',
    amount: [amountUsd.toString()],
    destinationAddress: demoWalletAddress,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    idempotencyKey: crypto.randomUUID(),
  } as Parameters<typeof client.createTransaction>[0]);
  const transferId = transferRes.data?.id;
  if (!transferId) throw new Error('Transfer did not return a transaction id');
  const transferResult = await waitForTransaction(transferId);
  console.log(`   ✓ Transfer settled: ${transferResult.txHash}\n`);

  console.log("2. Depositing into the demo wallet's own Circle Gateway balance...");
  const amountAtomic = Math.floor(amountUsd * 1_000_000).toString();
  const approval = await executeContractCall(demoWalletId, usdcAddress, 'approve(address,uint256)', [GATEWAY_WALLET_ADDRESS, amountAtomic]);
  await waitForTransaction(approval.id);
  const deposit = await executeContractCall(demoWalletId, GATEWAY_WALLET_ADDRESS, 'deposit(address,uint256)', [usdcAddress, amountAtomic]);
  const depositResult = await waitForTransaction(deposit.id);
  console.log(`   ✓ Deposited: ${depositResult.txHash}\n`);

  console.log(`✅ Demo buyer wallet topped up by $${amountUsd.toFixed(2)}.`);
}

main().catch(err => {
  console.error('Top-up failed:', err.message);
  process.exit(1);
});
