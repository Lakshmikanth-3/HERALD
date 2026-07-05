// HERALD — Real Circle EIP-712 signing, exposed as a generic BatchEvmSigner
//
// Circle's Developer-Controlled Wallets API requires every sign request to carry
// a freshly-generated `entitySecretCiphertext`: the entity secret RSA-OAEP-256
// encrypted with Circle's current entity public key. This is NOT reusable across
// requests — Circle rejects a reused ciphertext. See:
// https://developers.circle.com/w3s/entity-secret-management
//
// Endpoint verified live against this account's own wallet on 2026-07-04:
// POST https://api.circle.com/v1/w3s/developer/sign/typedData -> 200 with a real
// secp256k1 signature. (An earlier version of this file called
// `/v1/wallets/sign` — that endpoint does not exist on Circle's API and always
// returned 404. It has been replaced with the real one below.)
//
// This exposes a `BatchEvmSigner` — the exact interface
// @circle-fin/x402-batching/client's BatchEvmScheme expects — so HERALD can use
// Circle's real Gateway-batched x402 payment flow (the hackathon's actual
// reference implementation, github.com/circlefin/arc-nanopayments) while
// keeping custody of the private key with Circle's HSM. The alternative,
// @circle-fin/x402-batching's GatewayClient, requires a raw private key
// directly, which would break the Developer-Controlled Wallet security model
// this project is built on.

import type { Address, Hex } from 'viem';
import { getCircleApiKey, getHeraldWalletId, getHeraldWalletAddress } from './secrets';
import { CIRCLE_BASE, buildEntitySecretCiphertext } from './circleEntitySecret';

export interface TypedDataDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export interface BatchEvmSigner {
  address: Address;
  signTypedData: (params: {
    domain: TypedDataDomain;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<Hex>;
}

// Circle's typed-data JSON payload must have all struct fields as strings
// (bigint/hex), never native bigint — JSON.stringify would throw on those.
function toJsonSafeMessage(message: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(message)) {
    out[key] = typeof value === 'bigint' ? value.toString() : value;
  }
  return out;
}

async function signTypedDataViaCircle(params: {
  domain: TypedDataDomain;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}): Promise<Hex> {
  const circleApiKey = await getCircleApiKey();
  const walletId = await getHeraldWalletId();

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
    message: toJsonSafeMessage(params.message),
  });

  const entitySecretCiphertext = await buildEntitySecretCiphertext(circleApiKey);

  const signRes = await fetch(`${CIRCLE_BASE}/v1/w3s/developer/sign/typedData`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${circleApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletId, data: typedData, entitySecretCiphertext }),
  });

  if (!signRes.ok) {
    throw new Error(`Circle signTypedData failed: ${signRes.status} ${await signRes.text()}`);
  }

  const signData = await signRes.json() as { data: { signature: Hex } };
  return signData.data.signature;
}

// Builds a BatchEvmSigner backed by Circle's Developer-Controlled Wallets API,
// suitable for @circle-fin/x402-batching/client's BatchEvmScheme.
export async function getCircleEvmSigner(): Promise<BatchEvmSigner> {
  const address = await getHeraldWalletAddress();
  return {
    address: address as Address,
    signTypedData: signTypedDataViaCircle,
  };
}
