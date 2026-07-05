// HERALD — Demo buyer wallet: a real, independent Circle wallet used to prove
// a genuine third-party x402 purchase from the UI.
//
// Circle's Gateway facilitator rejects same-wallet payments as `self_transfer`
// (confirmed live in scripts/test-third-party-purchase.ts) — since this
// deployment only runs one HERALD agent, every brief in "Your Briefs" and the
// marketplace is the agent's own, so a purchase button that paid with the
// agent's own wallet would always fail. This wallet is a separate, real Arc
// testnet wallet the UI can pay from instead, so "Buy" actually succeeds.
//
// It's provisioned once (lazily, on first use) and its wallet id/address are
// cached in agent_config — not a secret, just an identifier; custody is via
// the same Circle entity secret as every other wallet in this project.

import crypto from 'crypto';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { BatchEvmScheme } from '@circle-fin/x402-batching/client';
import type { Address, Hex } from 'viem';
import { getCircleApiKey, getCircleEntitySecret, getHeraldWalletId } from './secrets';
import { buildEntitySecretCiphertext, CIRCLE_BASE } from './circleEntitySecret';
import { getUsdcTokenAddress, GATEWAY_WALLET_ADDRESS } from '../shared/chain';
import { getConfig, setConfig } from '../shared/db';

const TERMINAL_SUCCESS = new Set(['COMPLETE', 'CONFIRMED']);
const TERMINAL_FAILURE = new Set(['FAILED', 'DENIED', 'CANCELLED']);

// Funds the demo wallet with enough Gateway balance for ~10 typical brief
// purchases ($0.03-0.05 each) without needing to re-fund on every buy.
const FUND_AMOUNT_USDC = '0.6';
const DEPOSIT_AMOUNT_ATOMIC = '500000'; // 0.5 USDC, 6 decimals

async function waitForTransaction(circleApiKey: string, id: string, timeoutMs = 90000): Promise<{ state: string; txHash?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${CIRCLE_BASE}/v1/w3s/transactions/${id}`, {
      headers: { Authorization: `Bearer ${circleApiKey}` },
    });
    if (!res.ok) throw new Error(`Failed to poll transaction ${id}: ${res.status} ${await res.text()}`);
    const data = await res.json() as { data: { transaction: { state: string; txHash?: string } } };
    const { state, txHash } = data.data.transaction;
    if (TERMINAL_SUCCESS.has(state)) return { state, txHash };
    if (TERMINAL_FAILURE.has(state)) throw new Error(`Transaction ${id} ended in state ${state}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Transaction ${id} did not reach a terminal state within ${timeoutMs}ms`);
}

async function executeContractCall(
  circleApiKey: string,
  walletId: string,
  contractAddress: string,
  abiFunctionSignature: string,
  abiParameters: string[]
): Promise<{ id: string }> {
  const entitySecretCiphertext = await buildEntitySecretCiphertext(circleApiKey);
  const res = await fetch(`${CIRCLE_BASE}/v1/w3s/developer/transactions/contractExecution`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${circleApiKey}`, 'Content-Type': 'application/json' },
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
  const data = await res.json() as { data: { id: string } };
  return { id: data.data.id };
}

interface DemoWallet {
  id: string;
  address: string;
}

// Lazily provisions the demo buyer wallet on first use: creates a real Arc
// testnet wallet, transfers real testnet USDC to it from the agent wallet,
// deposits it into the buyer's own Circle Gateway balance, then caches the
// wallet id/address so this only happens once.
async function getOrProvisionDemoWallet(): Promise<DemoWallet> {
  const existingId = getConfig('demoBuyerWalletId');
  const existingAddress = getConfig('demoBuyerWalletAddress');
  if (existingId && existingAddress) {
    return { id: existingId, address: existingAddress };
  }

  const circleApiKey = await getCircleApiKey();
  const entitySecret = await getCircleEntitySecret();
  const agentWalletId = await getHeraldWalletId();
  const usdcAddress = getUsdcTokenAddress();
  const client = initiateDeveloperControlledWalletsClient({ apiKey: circleApiKey, entitySecret });

  const walletSetRes = await client.createWalletSet({ name: 'herald-demo-buyer-set', idempotencyKey: crypto.randomUUID() });
  const walletSetId = walletSetRes.data?.walletSet?.id;
  if (!walletSetId) throw new Error('Circle did not return a wallet set id while provisioning the demo buyer wallet');

  const walletRes = await client.createWallets({
    blockchains: ['ARC-TESTNET'],
    count: 1,
    walletSetId,
    accountType: 'EOA',
    idempotencyKey: crypto.randomUUID(),
  });
  const wallet = walletRes.data?.wallets?.[0];
  if (!wallet) throw new Error('Circle did not return a wallet while provisioning the demo buyer wallet');

  // Fund it from the agent wallet (a real on-chain transfer)
  const transferRes = await client.createTransaction({
    walletId: agentWalletId,
    tokenAddress: usdcAddress,
    blockchain: 'ARC-TESTNET',
    amount: [FUND_AMOUNT_USDC],
    destinationAddress: wallet.address,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    idempotencyKey: crypto.randomUUID(),
  } as Parameters<typeof client.createTransaction>[0]);
  const transferId = transferRes.data?.id;
  if (!transferId) throw new Error('Funding transfer did not return a transaction id');
  await waitForTransaction(circleApiKey, transferId);

  // Deposit into the demo wallet's own Circle Gateway balance
  const approval = await executeContractCall(circleApiKey, wallet.id, usdcAddress, 'approve(address,uint256)', [GATEWAY_WALLET_ADDRESS, DEPOSIT_AMOUNT_ATOMIC]);
  await waitForTransaction(circleApiKey, approval.id);
  const deposit = await executeContractCall(circleApiKey, wallet.id, GATEWAY_WALLET_ADDRESS, 'deposit(address,uint256)', [usdcAddress, DEPOSIT_AMOUNT_ATOMIC]);
  await waitForTransaction(circleApiKey, deposit.id);

  setConfig('demoBuyerWalletId', wallet.id);
  setConfig('demoBuyerWalletAddress', wallet.address);

  return { id: wallet.id, address: wallet.address };
}

// A BatchEvmSigner bound to the demo wallet — same Circle sign/typedData
// endpoint circleSign.ts uses for the agent's own wallet, parameterized.
function buildSignerFor(walletId: string, address: string, circleApiKey: string) {
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
      const entitySecretCiphertext = await buildEntitySecretCiphertext(circleApiKey);
      const signRes = await fetch(`${CIRCLE_BASE}/v1/w3s/developer/sign/typedData`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${circleApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, data: typedData, entitySecretCiphertext }),
      });
      if (!signRes.ok) throw new Error(`Circle signTypedData failed: ${signRes.status} ${await signRes.text()}`);
      const signData = await signRes.json() as { data: { signature: Hex } };
      return signData.data.signature;
    },
  };
}

export interface DemoPurchaseResult {
  brief: Record<string, unknown>;
  buyerAddress: string;
  txHash?: string;
}

// Buys a live published brief for real, paid from the demo buyer wallet
// (not the agent's own) — this is the purchase HERALD's own UI triggers.
export async function buyBriefAsDemoWallet(briefId: string, apiBase: string): Promise<DemoPurchaseResult> {
  const circleApiKey = await getCircleApiKey();
  const wallet = await getOrProvisionDemoWallet();

  const challengeRes = await fetch(`${apiBase}/api/briefs/${briefId}`);
  if (challengeRes.status !== 402) {
    throw new Error(`Expected a 402 challenge, got HTTP ${challengeRes.status}`);
  }
  const challenge = await challengeRes.json() as { accepts: Array<Record<string, unknown>> };
  const requirements = challenge.accepts[0];

  const signer = buildSignerFor(wallet.id, wallet.address, circleApiKey);
  const scheme = new BatchEvmScheme(signer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { x402Version, payload } = await scheme.createPaymentPayload(2, requirements as any);
  const xPaymentHeader = Buffer.from(JSON.stringify({ x402Version, payload })).toString('base64');

  const unlockRes = await fetch(`${apiBase}/api/briefs/${briefId}`, {
    headers: { 'X-PAYMENT': xPaymentHeader },
  });
  const body = await unlockRes.json();
  if (!unlockRes.ok) {
    throw new Error(body.error ?? `Purchase failed: HTTP ${unlockRes.status}`);
  }

  let txHash: string | undefined;
  const paymentResponseHeader = unlockRes.headers.get('x-payment-response');
  if (paymentResponseHeader) {
    try {
      const decoded = JSON.parse(Buffer.from(paymentResponseHeader, 'base64').toString('utf-8')) as { transaction?: string };
      txHash = decoded.transaction;
    } catch { /* not fatal */ }
  }

  return { brief: body, buyerAddress: wallet.address, txHash };
}
