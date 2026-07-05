// @ts-nocheck
// HERALD — Sources Treasury Wallet Provisioner
// Creates a SECOND, separate Circle Developer-Controlled Wallet on Arc
// Testnet — the payTo address for the real x402-gated content in
// server/routes/sources.ts. Keeping it separate from HERALD_WALLET_ADDRESS
// means the agent is genuinely paying a different party for sources, not
// moving money to itself.
//
// Reuses the entity secret from `npm run provision:wallet` — do NOT generate
// a new one here (Circle allows only one entity secret per API key).
//
// Usage: npx tsx scripts/provision-sources-wallet.ts

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import crypto from 'crypto'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY!
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET!

async function main() {
  console.log('HERALD — Sources Treasury Wallet Provisioner')
  console.log('=============================================\n')

  if (!CIRCLE_API_KEY || !ENTITY_SECRET) {
    console.error('Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET in .env.local.')
    console.error('Run `npm run provision:wallet` first — it generates and registers the entity secret this script reuses.')
    process.exit(1)
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey: CIRCLE_API_KEY,
    entitySecret: ENTITY_SECRET,
  })

  try {
    console.log('1. Creating wallet set for the sources treasury...')
    const walletSetRes = await client.createWalletSet({
      name: 'herald-sources-treasury-set',
      idempotencyKey: crypto.randomUUID(),
    })
    const walletSetId = walletSetRes.data?.walletSet?.id
    if (!walletSetId) throw new Error('No wallet set ID returned')
    console.log(`   ✓ Wallet set created: ${walletSetId}\n`)

    console.log('2. Creating sources-treasury wallet on Arc Testnet...')
    const walletRes = await client.createWallets({
      blockchains: ['ARC-TESTNET'],
      count: 1,
      walletSetId,
      accountType: 'EOA',
      idempotencyKey: crypto.randomUUID(),
    })

    const wallet = walletRes.data?.wallets?.[0]
    if (!wallet) throw new Error('Wallet creation failed')

    console.log('   ✓ Wallet created!\n')
    console.log('=============================================')
    console.log('HERALD SOURCES TREASURY WALLET PROVISIONED')
    console.log('=============================================')
    console.log(`Wallet ID:      ${wallet.id}`)
    console.log(`Wallet Address: ${wallet.address}\n`)

    console.log('NEXT STEPS:')
    console.log('1. Add these to .env.local:')
    console.log(`   HERALD_SOURCES_WALLET_ID=${wallet.id}`)
    console.log(`   HERALD_SOURCES_WALLET_ADDRESS=${wallet.address}`)
    console.log('2. Run `npm run seed:sources` to populate real, originally-authored paid content.')
  } catch (err: any) {
    console.error('Provisioning failed:', err?.response?.data || err.message)
    process.exit(1)
  }
}

main().catch(console.error)
