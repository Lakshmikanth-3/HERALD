import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@1claw/sdk'

const VAULT_ID = process.env.ONECLAW_VAULT_ID
const AGENT_ID = process.env.ONECLAW_AGENT_ID
const API_KEY = process.env.ONECLAW_AGENT_API_KEY
const BASE_URL = process.env.ONECLAW_BASE_URL ?? 'https://api.1claw.xyz'

if (!VAULT_ID || !AGENT_ID || !API_KEY) {
  console.error('Missing ONECLAW config in .env.local')
  process.exit(1)
}

const client = createClient({
  baseUrl: BASE_URL,
  agentId: AGENT_ID,
  apiKey: API_KEY,
})

async function storeSecret(path, value, description) {
  if (!value || value.includes('PASTE_')) {
    console.warn(`  ⚠ Skipping ${path} — value not set`)
    return
  }
  try {
    await client.secrets.set(VAULT_ID, path, value)
    console.log(`  ✓ ${path} — ${description}`)
  } catch (err) {
    console.error(`  ✗ ${path} failed:`, err?.response?.data || err.message)
  }
}

async function main() {
  console.log('HERALD — 1Claw Vault Seeder (Native ESM)')
  console.log('==========================================\n')

  console.log('Storing secrets in vault:', VAULT_ID)
  console.log('')

  await storeSecret('CIRCLE_API_KEY',         process.env.CIRCLE_API_KEY          || '', 'Circle API key')
  await storeSecret('GEMINI_API_KEY',          process.env.GEMINI_API_KEY          || '', 'Google Gemini API key (synthesis)')
  await storeSecret('HERALD_WALLET_ID',        process.env.HERALD_WALLET_ID        || '', 'Circle Agent Wallet ID')
  await storeSecret('HERALD_WALLET_ADDRESS',   process.env.HERALD_WALLET_ADDRESS   || '', 'Circle Agent Wallet Address')

  console.log('\n✅ Vault seeding complete.')
}

main().catch(console.error)
