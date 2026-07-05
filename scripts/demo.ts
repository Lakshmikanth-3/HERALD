// HERALD — Demo script for recording a walkthrough (Loom, etc.)
// Triggers one real agent cycle against a running `npm run dev`, waits for
// it to finish, then prints an ordered list of URLs and real data points to
// narrate over. Nothing here is scripted/mocked — it's the same
// POST /api/agent/run a user clicking "Run Now" would trigger.
//
// Usage: npm run dev (in one terminal), then npm run demo (in another)

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const APP_BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:3001/api';

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}\n${title}\n${'─'.repeat(60)}`);
}

async function main() {
  console.log('🎬 HERALD Demo Setup\n');

  const statusRes = await fetch(`${API_BASE}/agent/status`).catch(() => null);
  if (!statusRes?.ok) {
    console.error('❌ Backend not reachable at :3001. Run `npm run dev` first, then re-run `npm run demo`.');
    process.exit(1);
  }
  const status = await statusRes.json();

  if (!status.configured) {
    console.log('⚠️  No agent configured yet.');
    console.log(`   Open ${APP_BASE}/deploy, set a topic + budget, and deploy — then re-run \`npm run demo\`.`);
    process.exit(1);
  }

  const chainInfoRes = await fetch(`${API_BASE}/agent/chain-info`);
  const chainInfo = await chainInfoRes.json();
  const balanceRes = await fetch(`${API_BASE}/agent/balance`);
  const balance = await balanceRes.json();

  console.log(`Topic: "${status.topic}"`);
  console.log(`Wallet: ${chainInfo.agentWalletAddress} ($${balance.usdcBalance.toFixed(4)} USDC)`);

  if (status.isRunning) {
    console.log('\nA cycle is already running — waiting for it to finish before starting a new one...');
  } else {
    console.log('\nTriggering a real agent cycle (discover → score → pay → synthesize → publish)...');
    const runRes = await fetch(`${API_BASE}/agent/run`, { method: 'POST' });
    if (!runRes.ok) {
      console.error(`❌ Failed to trigger a cycle: ${await runRes.text()}`);
      process.exit(1);
    }
  }

  process.stdout.write('Waiting for the cycle to complete');
  let running = true;
  for (let i = 0; i < 40 && running; i++) {
    await new Promise(r => setTimeout(r, 1500));
    process.stdout.write('.');
    const s = await (await fetch(`${API_BASE}/agent/status`)).json();
    running = s.isRunning;
  }
  console.log(running ? ' still running (check the Economy page directly)' : ' done.');

  const briefsRes = await fetch(`${API_BASE}/briefs?limit=1`);
  const briefs = await briefsRes.json();
  const paymentsRes = await fetch(`${API_BASE}/agent/payments?limit=5`);
  const payments = await paymentsRes.json();
  const finalBalanceRes = await fetch(`${API_BASE}/agent/balance`);
  const finalBalance = await finalBalanceRes.json();

  section('Real data from this cycle');
  if (briefs.length > 0) {
    console.log(`Latest brief: "${briefs[0].title}" — $${briefs[0].priceUsd.toFixed(3)}, ${briefs[0].sourcesCount} source(s)`);
  }
  console.log(`Spent today: $${finalBalance.spentToday.toFixed(4)}  ·  Earned today: $${finalBalance.earnedToday.toFixed(4)}`);
  console.log(`Recent payments (${payments.length}):`);
  for (const p of payments.slice(0, 5)) {
    console.log(`  - ${p.type} $${p.amountUsd.toFixed(4)} — ${p.reason.slice(0, 70)}`);
  }

  section('Recording walkthrough — visit in this order');
  console.log(`1. ${APP_BASE}/                 — the pitch (landing page, real live stats in the Stats section)`);
  console.log(`2. ${APP_BASE}/deploy            — how you'd configure a new agent (topic, budget, price floor)`);
  console.log(`3. ${APP_BASE}/economy           — click "Run Now" on camera; narrate the stepper, flow graph, live feed as they update`);
  console.log(`4. ${APP_BASE}/library           — open a brief, point out "Payment receipts" and "Copy x402 link"`);
  console.log(`5. ${APP_BASE}/network           — the public, no-login dashboard`);
  console.log(`6. ${APP_BASE}/how-it-works      — the "verify it's real" table; click an explorer link live`);
  console.log(`\nReal wallet to click through on the explorer:`);
  console.log(`   ${chainInfo.explorerBase}/address/${chainInfo.agentWalletAddress}`);
  if (briefs.length > 0) {
    console.log(`\nReproduce a live 402 on camera:`);
    console.log(`   curl -i ${API_BASE.replace('/api', '')}/api/briefs/${briefs[0].id}`);
  }
}

main().catch(err => {
  console.error('Demo script failed:', err.message);
  process.exit(1);
});
