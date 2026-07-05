// HERALD — Circle entity-secret ciphertext builder
//
// Circle's Developer-Controlled Wallets API requires every sensitive request
// (typed-data signing, contract execution) to carry a freshly-generated
// `entitySecretCiphertext`: the entity secret RSA-OAEP-256 encrypted with
// Circle's current entity public key. Reusing a ciphertext across requests is
// rejected. See: https://developers.circle.com/w3s/entity-secret-management
//
// Shared by circleSign.ts (typed-data signing for x402) and gateway.ts
// (contract execution for Gateway deposits) so both hit the real
// GET /v1/w3s/config/entity/publicKey endpoint the same way.

import crypto from 'crypto';
import { getCircleEntitySecret } from './secrets';

export const CIRCLE_BASE = 'https://api.circle.com';

let cachedPublicKey: string | null = null;

async function getEntityPublicKey(circleApiKey: string): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  const res = await fetch(`${CIRCLE_BASE}/v1/w3s/config/entity/publicKey`, {
    headers: { Authorization: `Bearer ${circleApiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Circle entity public key: ${res.status} ${await res.text()}`);
  }
  const data = await res.json() as { data: { publicKey: string } };
  cachedPublicKey = data.data.publicKey;
  return cachedPublicKey;
}

export async function buildEntitySecretCiphertext(circleApiKey: string): Promise<string> {
  const entitySecret = await getCircleEntitySecret();
  const publicKey = await getEntityPublicKey(circleApiKey);
  const encrypted = crypto.publicEncrypt(
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(entitySecret, 'hex')
  );
  return encrypted.toString('base64');
}
