// HERALD — 1Claw Vault Seeder
// Stores all necessary secrets into the 1Claw vault so the agent never needs .env
// Run ONCE after provisioning your wallet.
//
// Usage: npx tsx scripts/seed-vault.ts

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const VAULT_ID = process.env.ONECLAW_VAULT_ID!
const AGENT_ID = process.env.ONECLAW_AGENT_ID!
const API_KEY = process.env.ONECLAW_AGENT_API_KEY!
const BASE_URL = process.env.ONECLAW_BASE_URL ?? 'https://api.1claw.xyz'

let _token = ''
async function getToken() {
  if (_token) return _token;
  const res = await fetch(`${BASE_URL}/v1/auth/agent-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: API_KEY, agent_id: AGENT_ID })
  });
  if (!res.ok) throw new Error(`Agent Auth Failed: ${await res.text()}`);
  const data = await res.json();
  _token = data.access_token;
  return _token;
}

async function storeSecret(path: string, value: string, description: string) {
  if (!value || value.includes('PASTE_')) {
    console.warn(`  ⚠ Skipping ${path} — value not set`)
    return
  }
  try {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/v1/vaults/${VAULT_ID}/secrets/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value, type: 'generic' })
    })
    if (!res.ok) throw new Error(await res.text())
    console.log(`  ✓ ${path} — ${description}`)
  } catch (err: any) {
    console.error(`  ✗ ${path} failed:`, err.message)
  }
}

async function main() {
  console.log('HERALD — 1Claw Vault Seeder')
  console.log('============================\n')

  if (!process.env.ONECLAW_VAULT_ID || !process.env.ONECLAW_AGENT_ID) {
    console.error('Missing ONECLAW_VAULT_ID or ONECLAW_AGENT_ID in .env.local')
    process.exit(1)
  }

  console.log('Storing secrets in vault:', VAULT_ID)
  console.log('')

  await storeSecret('CIRCLE_API_KEY',         process.env.CIRCLE_API_KEY          ?? '', 'Circle API key')
  await storeSecret('CIRCLE_ENTITY_SECRET',    process.env.CIRCLE_ENTITY_SECRET    ?? '', 'Circle entity secret (for signing)')
  await storeSecret('GEMINI_API_KEY',          process.env.GEMINI_API_KEY          ?? '', 'Google Gemini API key (synthesis)')
  await storeSecret('HERALD_WALLET_ID',        process.env.HERALD_WALLET_ID        ?? '', 'Circle Agent Wallet ID')
  await storeSecret('HERALD_WALLET_ADDRESS',   process.env.HERALD_WALLET_ADDRESS   ?? '', 'Circle Agent Wallet Address')

  console.log('\n✅ Vault seeding complete.')
  console.log('The agent will now fetch all keys at runtime from 1Claw — no keys in code or env.')
}

main().catch(console.error)
