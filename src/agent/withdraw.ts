// HERALD — Withdraw earnings: a real on-chain USDC transfer out of the
// agent's own wallet, to an address the user supplies. Uses Circle's
// Developer-Controlled Wallets SDK directly — the same one
// scripts/provision-wallet.ts and scripts/test-third-party-purchase.ts use
// for wallet-to-wallet transfers, as opposed to the hand-rolled raw-fetch
// contractExecution path in gateway.ts (that path is for calling arbitrary
// contract functions like approve/deposit; a plain token transfer is a
// first-class SDK operation, so there's no reason to reimplement it).

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { v4 as uuidv4 } from 'uuid';
import { getCircleApiKey, getCircleEntitySecret, getHeraldWalletId } from './secrets';
import { CIRCLE_BASE } from './circleEntitySecret';
import { getUsdcTokenAddress } from '../shared/chain';

const TERMINAL_SUCCESS = new Set(['COMPLETE', 'CONFIRMED']);
const TERMINAL_FAILURE = new Set(['FAILED', 'DENIED', 'CANCELLED']);

export interface WithdrawResult {
  txHash?: string;
  amountUsd: number;
  destinationAddress: string;
}

export async function withdrawEarnings(amountUsd: number, destinationAddress: string): Promise<WithdrawResult> {
  const circleApiKey = await getCircleApiKey();
  const entitySecret = await getCircleEntitySecret();
  const walletId = await getHeraldWalletId();
  const usdcAddress = getUsdcTokenAddress();

  const client = initiateDeveloperControlledWalletsClient({ apiKey: circleApiKey, entitySecret });

  const transferRes = await client.createTransaction({
    walletId,
    tokenAddress: usdcAddress,
    blockchain: 'ARC-TESTNET',
    amount: [amountUsd.toString()],
    destinationAddress,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    idempotencyKey: uuidv4(),
  } as Parameters<typeof client.createTransaction>[0]);

  const transferId = transferRes.data?.id;
  if (!transferId) throw new Error('Circle did not return a transaction id for the withdrawal');

  const start = Date.now();
  while (Date.now() - start < 90000) {
    const statusRes = await fetch(`${CIRCLE_BASE}/v1/w3s/transactions/${transferId}`, {
      headers: { Authorization: `Bearer ${circleApiKey}` },
    });
    if (!statusRes.ok) throw new Error(`Failed to poll withdrawal transaction: ${statusRes.status} ${await statusRes.text()}`);
    const data = await statusRes.json() as { data: { transaction: { state: string; txHash?: string } } };
    const { state, txHash } = data.data.transaction;
    if (TERMINAL_SUCCESS.has(state)) return { txHash, amountUsd, destinationAddress };
    if (TERMINAL_FAILURE.has(state)) throw new Error(`Withdrawal transaction ended in state ${state}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Withdrawal transaction did not reach a terminal state within 90s');
}
