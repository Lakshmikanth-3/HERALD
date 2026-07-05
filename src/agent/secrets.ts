// HERALD — 1Claw Vault: Fetch API secrets at runtime
// The @1claw/sdk is ESM-only. We use a dynamic import to load it
// within the CommonJS/tsx context.

const VAULT_ID = () => process.env.ONECLAW_VAULT_ID!

// In-process cache so vault is called at most once per secret per process lifecycle
const cache = new Map<string, string>()

// Retries only network-level failures (undici throwing "fetch failed" — a
// dropped/stale keep-alive connection on a long-running process, observed in
// practice against 1Claw's API). Non-2xx HTTP responses are real answers from
// the server (401, secret not found, etc.) and must NOT be retried here —
// they're handled by the caller.
async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
}

let _token = ''
async function getToken() {
  if (_token) return _token;
  const res = await fetchWithRetry(`${process.env.ONECLAW_BASE_URL ?? 'https://api.1claw.xyz'}/v1/auth/agent-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.ONECLAW_AGENT_API_KEY,
      agent_id: process.env.ONECLAW_AGENT_ID
    })
  });
  if (!res.ok) throw new Error(`Agent Auth Failed: ${await res.text()}`);
  const data = await res.json();
  _token = data.access_token;
  return _token;
}

// Observed live: 1Claw's vault occasionally answers a secret read with its own
// x402 "payment required" challenge (HTTP 402) rather than the secret,
// self-resolving within seconds without ever being paid — almost certainly a
// rate-limit/quota mechanism on their side, not a hard requirement. We retry
// this specific case with a short backoff. We deliberately never construct or
// send a payment for it: the challenge is denominated in real mainnet USDC
// (eip155:8453 / Base), a completely different economic domain from the Arc
// testnet fake-money flows this project runs everywhere else — paying it
// automatically would be a real financial decision this code must not make
// unattended.
const VAULT_PAYMENT_RETRY_DELAYS_MS = [1500, 3000, 5000];

async function getSecret(path: string): Promise<string> {
  if (cache.has(path)) return cache.get(path)!
  try {
    const token = await getToken();
    const url = `${process.env.ONECLAW_BASE_URL ?? 'https://api.1claw.xyz'}/v1/vaults/${VAULT_ID()}/secrets/${path}`;

    let res = await fetchWithRetry(url, { headers: { 'Authorization': `Bearer ${token}` } });

    for (const delayMs of VAULT_PAYMENT_RETRY_DELAYS_MS) {
      if (res.status !== 402) break;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      res = await fetchWithRetry(url, { headers: { 'Authorization': `Bearer ${token}` } });
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error(`1Claw API Key is expired or invalid (401 Unauthorized). Please update ONECLAW_AGENT_API_KEY.`);
      }
      if (res.status === 402) {
        throw new Error(`1Claw vault is rate-limited (still 402 after retries) — wait a moment and try again, or check your 1Claw dashboard for quota/billing.`);
      }
      throw new Error(`1Claw Error: ${await res.text()}`);
    }
    const data = await res.json();
    if (!data?.value) throw new Error(`1Claw: secret not found at path "${path}"`)
    cache.set(path, data.value)
    return data.value
  } catch (err) {
    throw new Error(`Failed to fetch secret ${path}: ${(err as Error).message}`)
  }
}

export async function getCircleApiKey(): Promise<string> {
  return getSecret('CIRCLE_API_KEY')
}

export async function getCircleEntitySecret(): Promise<string> {
  return getSecret('CIRCLE_ENTITY_SECRET')
}

export async function getGeminiApiKey(): Promise<string> {
  return getSecret('GEMINI_API_KEY')
}

export async function getHeraldWalletId(): Promise<string> {
  return getSecret('HERALD_WALLET_ID')
}

export async function getHeraldWalletAddress(): Promise<string> {
  return getSecret('HERALD_WALLET_ADDRESS')
}

export function clearSecretsCache(): void {
  cache.clear()
}
