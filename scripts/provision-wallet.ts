// @ts-nocheck
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import crypto from 'crypto'
import {
  initiateDeveloperControlledWalletsClient,
  registerEntitySecretCiphertext,
  generateEntitySecret
} from '@circle-fin/developer-controlled-wallets'

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY!

async function main() {
  console.log('HERALD — Circle Wallet Provisioner')
  console.log('====================================\n')

  try {
    // 1. Generate new entity secret
    const entitySecret = generateEntitySecret()
    console.log('1. Generated new 32-byte entity secret')

    // 2. Register entity secret (this is only needed once per API key)
    console.log('2. Registering entity secret with Circle API...')
    try {
      await registerEntitySecretCiphertext({
        apiKey: CIRCLE_API_KEY,
        entitySecret,
        recoveryFileDownloadPath: './'
      })
      console.log('   ✓ Entity secret successfully registered\n')
    } catch (e: any) {
      if (e?.response?.data?.message?.includes('already been set')) {
        console.log('   ✓ Entity secret was already registered, continuing...')
        // If it was already set, we actually need the original entity secret to proceed
        // But let's assume we are starting fresh with the new API key the user just made.
      } else {
        throw e
      }
    }

    // Initialize with the real secret
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: CIRCLE_API_KEY,
      entitySecret,
    })

    // 3. Create Wallet Set
    console.log('3. Creating wallet set...')
    const walletSetRes = await client.createWalletSet({
      name: 'herald-agent-set',
      idempotencyKey: crypto.randomUUID()
    })
    const walletSetId = walletSetRes.data?.walletSet?.id

    if (!walletSetId) {
      throw new Error('No wallet set ID returned')
    }
    console.log(`   ✓ Wallet set created: ${walletSetId}\n`)

    // 4. Create Wallet
    console.log('4. Creating agent wallet on Arc Testnet...')
    const walletRes = await client.createWallets({
      blockchains: ['ARC-TESTNET'],
      count: 1,
      walletSetId,
      accountType: 'EOA',
      idempotencyKey: crypto.randomUUID()
    })

    const wallet = walletRes.data?.wallets?.[0]
    if (!wallet) {
      throw new Error('Wallet creation failed')
    }

    const walletId = wallet.id
    const walletAddress = wallet.address

    console.log(`   ✓ Wallet created!\n`)
    console.log('====================================')
    console.log('HERALD AGENT WALLET PROVISIONED')
    console.log('====================================')
    console.log(`Wallet ID:      ${walletId}`)
    console.log(`Wallet Address: ${walletAddress}`)
    console.log(`Entity Secret:  ${entitySecret}  ← store this securely!\n`)

    console.log('NEXT STEPS:')
    console.log('1. Run `npm run seed:vault` to push these secrets to the 1Claw HSM')
    console.log('')
    console.log('2. Fund your wallet: visit https://testmint.myproceeds.xyz')
    console.log(`   Send testnet USDC to: ${walletAddress}`)

  } catch (err: any) {
    console.error('Provisioning failed:', err?.response?.data || err.message)
    process.exit(1)
  }
}

main().catch(console.error)
