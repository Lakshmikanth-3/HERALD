// HERALD — Real Circle Gateway deposit (approve + deposit on-chain)
//
// Buying anything through @circle-fin/x402-batching's Gateway-batched x402
// flow (agent/circleSign.ts, agent/buyer.ts, server/routes/agent.ts's /pay
// route) spends from the wallet's *Gateway* balance, not its raw on-chain USDC
// balance. Getting funds into Gateway requires two real on-chain transactions:
//   1. ERC20 approve() — let the GatewayWallet contract pull USDC
//   2. GatewayWallet.deposit(token, value) — move USDC into the Gateway
//
// Both are executed via Circle's real contract-execution API (verified live
// 2026-07-04): POST /v1/w3s/developer/transactions/contractExecution, the
// same endpoint used elsewhere in this codebase for real signing
// (/v1/w3s/developer/sign/typedData). The exact ABI function signatures below
// were extracted directly from @circle-fin/x402-batching's compiled
// GatewayClient.deposit() implementation, so they match the real deployed
// GatewayWallet contract.

import { v4 as uuidv4 } from 'uuid';
import { getCircleApiKey, getHeraldWalletId } from './secrets';
import { buildEntitySecretCiphertext, CIRCLE_BASE } from './circleEntitySecret';
import { getUsdcTokenAddress, GATEWAY_WALLET_ADDRESS } from '../shared/chain';
import { emit } from '../shared/events';

interface ContractExecutionResult {
  id: string;
}

const TERMINAL_SUCCESS = new Set(['COMPLETE', 'CONFIRMED']);
const TERMINAL_FAILURE = new Set(['FAILED', 'DENIED', 'CANCELLED']);

async function executeContractCall(
  contractAddress: string,
  abiFunctionSignature: string,
  abiParameters: Array<string>
): Promise<ContractExecutionResult> {
  const circleApiKey = await getCircleApiKey();
  const walletId = await getHeraldWalletId();
  const entitySecretCiphertext = await buildEntitySecretCiphertext(circleApiKey);

  const res = await fetch(`${CIRCLE_BASE}/v1/w3s/developer/transactions/contractExecution`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${circleApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idempotencyKey: uuidv4(),
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      entitySecretCiphertext,
      feeLevel: 'MEDIUM',
    }),
  });

  if (!res.ok) {
    throw new Error(`Circle contractExecution failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as { data: { id: string } };
  return { id: data.data.id };
}

async function waitForTransaction(id: string, timeoutMs = 60000): Promise<{ state: string; txHash?: string }> {
  const circleApiKey = await getCircleApiKey();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${CIRCLE_BASE}/v1/w3s/transactions/${id}`, {
      headers: { Authorization: `Bearer ${circleApiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to poll transaction ${id}: ${res.status} ${await res.text()}`);
    }
    const data = await res.json() as { data: { transaction: { state: string; txHash?: string; errorReason?: string; errorDetails?: string } } };
    const { state, txHash, errorReason, errorDetails } = data.data.transaction;

    if (TERMINAL_SUCCESS.has(state)) return { state, txHash };
    if (TERMINAL_FAILURE.has(state)) {
      // Circle's transaction record carries the real on-chain revert reason
      // (e.g. "INSUFFICIENT_TOKEN" / "ERC20: transfer amount exceeds
      // balance") — surfacing only the transaction id and state left users
      // staring at an opaque UUID with no way to tell a real, correctable
      // problem (wallet underfunded for the requested deposit) from an
      // actual system failure.
      const reason = errorReason ? `${errorReason}${errorDetails ? ` — ${errorDetails}` : ''}` : `ended in state ${state}`;
      throw new Error(`Deposit transaction failed: ${reason}`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(`Transaction ${id} did not reach a terminal state within ${timeoutMs}ms`);
}

export interface DepositResult {
  approvalTxHash?: string;
  depositTxHash?: string;
  amountUsd: number;
}

// Deposits USDC into Circle's Gateway Wallet so the agent can spend it via
// Gateway-batched x402 payments (buying sources or other agents' briefs).
export async function depositToGateway(amountUsd: number): Promise<DepositResult> {
  const usdcAddress = getUsdcTokenAddress();
  const amountAtomic = Math.ceil(amountUsd * 1_000_000).toString(); // USDC has 6 decimals

  emit('agent:cycle:start', { stage: 'gateway-deposit', message: `Approving ${amountUsd} USDC for Gateway deposit` });

  const approval = await executeContractCall(
    usdcAddress,
    'approve(address,uint256)',
    [GATEWAY_WALLET_ADDRESS, amountAtomic]
  );
  const approvalResult = await waitForTransaction(approval.id);

  emit('agent:cycle:start', { stage: 'gateway-deposit', message: `Depositing ${amountUsd} USDC into Gateway` });

  const deposit = await executeContractCall(
    GATEWAY_WALLET_ADDRESS,
    'deposit(address,uint256)',
    [usdcAddress, amountAtomic]
  );
  const depositResult = await waitForTransaction(deposit.id);

  emit('agent:cycle:end', {
    stage: 'gateway-deposit-complete',
    amountUsd,
    approvalTxHash: approvalResult.txHash,
    depositTxHash: depositResult.txHash,
  });

  return {
    approvalTxHash: approvalResult.txHash,
    depositTxHash: depositResult.txHash,
    amountUsd,
  };
}
