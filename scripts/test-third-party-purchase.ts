// HERALD — Real third-party brief purchase test
//
// Validates the sell-side x402 gate (server/routes/briefs.ts) against a
// genuinely independent buyer — not the agent's own wallet. Circle's Gateway
// facilitator rejects same-wallet payments as `self_transfer` (confirmed
// live), so proving a real purchase settles requires a second wallet:
//
//   1. Provision a new "test buyer" wallet (reuses the existing entity secret)
//   2. Transfer a small amount of real testnet USDC to it from the agent wallet
//   3. Deposit that USDC into the buyer wallet's Circle Gateway balance
//   4. Sign a real EIP-712 Gateway-batched payment authorization AS the buyer
//   5. Redeem it against a live published brief and confirm real settlement
//
// Everything here is real: real wallet, real on-chain transfer, real Gateway
// deposit, real signature, real verify/settle against Circle's testnet API.
//
// Usage: npx tsx scripts/test-third-party-purchase.ts <briefId>

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import crypto from 'crypto';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { BatchEvmScheme } from '@circle-fin/x402-batching/client';
import type { Address, Hex } from 'viem';
import { buildEntitySecretCiphertext, CIRCLE_BASE } from '../src/agent/circleEntitySecret';
import { getUsdcTokenAddress, GATEWAY_WALLET_ADDRESS } from '../src/shared/chain';

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY!;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET!;
const AGENT_WALLET_ID = process.env.HERALD_WALLET_ID!;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

async function executeContractCall(
  walletId: string,
  contractAddress: string,
  abiFunctionSignature: string,
  abiParameters: string[]
): Promise<{ id: string }> {
  const entitySecretCiphertext = await buildEntitySecretCiphertext(CIRCLE_API_KEY);
  const res = await fetch(`${CIRCLE_BASE}/v1/w3s/developer/transactions/contractExecution`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CIRCLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      entitySecretCiphertext,
      feeLevel: 'MEDIUM',
    }),
  });
  if (!res.ok) throw new Error(`Circle contractExecution failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { data: { id: string } };
  return { id: data.data.id };
}

// A BatchEvmSigner bound to an arbitrary wallet (not the agent's own) — same
// Circle sign/typedData endpoint circleSign.ts uses, just parameterized.
function buildSignerFor(walletId: string, address: string) {
  return {
    address: address as Address,
    signTypedData: async (params: {
      domain: Record<string, unknown>;
      types: Record<string, Array<{ name: string; type: string }>>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<Hex> => {
      const jsonSafeMessage: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params.message)) {
        jsonSafeMessage[k] = typeof v === 'bigint' ? v.toString() : v;
      }
      const typedData = JSON.stringify({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          ...params.types,
        },
        primaryType: params.primaryType,
        domain: params.domain,
        message: jsonSafeMessage,
      });
      const entitySecretCiphertext = await buildEntitySecretCiphertext(CIRCLE_API_KEY);
      const signRes = await fetch(`${CIRCLE_BASE}/v1/w3s/developer/sign/typedData`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CIRCLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, data: typedData, entitySecretCiphertext }),
      });
      if (!signRes.ok) throw new Error(`Circle signTypedData failed: ${signRes.status} ${await signRes.text()}`);
      const signData = (await signRes.json()) as { data: { signature: Hex } };
      return signData.data.signature;
    },
  };
}

async function main() {
  const briefId = process.argv[2];
  if (!briefId) {
    console.error('Usage: npx tsx scripts/test-third-party-purchase.ts <briefId>');
    process.exit(1);
  }

  if (!CIRCLE_API_KEY || !ENTITY_SECRET || !AGENT_WALLET_ID) {
    console.error('Missing CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, or HERALD_WALLET_ID in .env.local');
    process.exit(1);
  }

  console.log('HERALD — Real Third-Party Purchase Test');
  console.log('========================================\n');

  const client = initiateDeveloperControlledWalletsClient({ apiKey: CIRCLE_API_KEY, entitySecret: ENTITY_SECRET });
  const usdcAddress = getUsdcTokenAddress();

  // 1. Provision an independent buyer wallet
  console.log('1. Provisioning an independent test-buyer wallet...');
  const walletSetRes = await client.createWalletSet({ name: 'herald-test-buyer-set', idempotencyKey: crypto.randomUUID() });
  const walletSetId = walletSetRes.data?.walletSet?.id;
  if (!walletSetId) throw new Error('No wallet set ID returned');

  const walletRes = await client.createWallets({
    blockchains: ['ARC-TESTNET'],
    count: 1,
    walletSetId,
    accountType: 'EOA',
    idempotencyKey: crypto.randomUUID(),
  });
  const buyerWallet = walletRes.data?.wallets?.[0];
  if (!buyerWallet) throw new Error('Wallet creation failed');
  console.log(`   ✓ Buyer wallet: ${buyerWallet.id} (${buyerWallet.address})\n`);

  // 2. Transfer real testnet USDC from the agent wallet to the buyer wallet.
  // On Arc, gas is paid in USDC itself (it's the native gas token AND the
  // ERC20 x402 asset) — transfer well above the intended deposit amount so
  // the approve() transaction's own gas fee doesn't eat into it (confirmed
  // live: a 0.05 transfer left only ~0.0486 after ~0.0014 of gas, just short
  // of covering a 0.05 deposit).
  console.log('2. Transferring 0.15 USDC from the agent wallet to the buyer wallet...');
  const transferRes = await client.createTransaction({
    walletId: AGENT_WALLET_ID,
    tokenAddress: usdcAddress,
    blockchain: 'ARC-TESTNET',
    amount: ['0.15'],
    destinationAddress: buyerWallet.address,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    idempotencyKey: crypto.randomUUID(),
  } as Parameters<typeof client.createTransaction>[0]);
  const transferId = transferRes.data?.id;
  if (!transferId) throw new Error('Transfer did not return a transaction id');
  const transferResult = await waitForTransaction(transferId);
  console.log(`   ✓ Transfer settled: ${transferResult.txHash}\n`);

  // 3. Deposit the buyer wallet's USDC into its own Circle Gateway balance
  // (mirrors agent/gateway.ts's depositToGateway, parameterized for the buyer wallet)
  console.log("3. Depositing buyer wallet's USDC into its Circle Gateway balance...");
  const amountAtomic = '50000'; // 0.05 USDC, 6 decimals
  const approval = await executeContractCall(buyerWallet.id, usdcAddress, 'approve(address,uint256)', [GATEWAY_WALLET_ADDRESS, amountAtomic]);
  await waitForTransaction(approval.id);
  const deposit = await executeContractCall(buyerWallet.id, GATEWAY_WALLET_ADDRESS, 'deposit(address,uint256)', [usdcAddress, amountAtomic]);
  await waitForTransaction(deposit.id);
  console.log('   ✓ Deposited into Gateway\n');

  // 4. Fetch a real 402 challenge for the target brief
  console.log(`4. Fetching x402 challenge for brief ${briefId}...`);
  const challengeRes = await fetch(`${API_BASE}/api/briefs/${briefId}`);
  if (challengeRes.status !== 402) throw new Error(`Expected 402, got ${challengeRes.status}`);
  const challenge = (await challengeRes.json()) as { accepts: Array<Record<string, unknown>> };
  const requirements = challenge.accepts[0];
  console.log(`   ✓ Challenge received — payTo: ${requirements.payTo}, amount: ${requirements.amount}\n`);

  // 5. Sign a real Gateway-batched payment authorization AS the buyer wallet
  console.log('5. Signing the payment authorization as the buyer wallet...');
  const signer = buildSignerFor(buyerWallet.id, buyerWallet.address);
  const scheme = new BatchEvmScheme(signer);
  const { x402Version, payload } = await scheme.createPaymentPayload(2, requirements as any);
  const xPaymentHeader = Buffer.from(JSON.stringify({ x402Version, payload })).toString('base64');
  console.log('   ✓ Signed\n');

  // 6. Redeem it — this is the real test: does it settle, or reject?
  console.log('6. Redeeming the signed payment against the live brief endpoint...');
  const unlockRes = await fetch(`${API_BASE}/api/briefs/${briefId}`, {
    headers: { 'X-PAYMENT': xPaymentHeader },
  });
  const unlockBody = await unlockRes.json();
  if (unlockRes.ok) {
    console.log(`   ✅ REAL THIRD-PARTY PURCHASE SUCCEEDED — brief unlocked: "${unlockBody.title}"`);
  } else {
    console.log(`   ❌ Purchase failed: ${unlockRes.status} ${JSON.stringify(unlockBody)}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
