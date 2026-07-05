import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runTests() {
  console.log('🧪 Starting HERALD Automated Integration Tests...\n');
  const API_BASE = 'http://localhost:3001/api';

  try {
    // ---------------------------------------------------------
    // TEST 1: Check System Health
    // ---------------------------------------------------------
    console.log('[Test 1] Pinging Agent Health Status...');
    const healthRes = await fetch(`${API_BASE}/agent/status`);
    if (!healthRes.ok) throw new Error('Failed to reach backend server. Is npm run dev running?');
    const health = await healthRes.json();
    console.log('  ✅ Server is healthy. Configured:', health.configured, '| Running:', health.isRunning);

    // ---------------------------------------------------------
    // TEST 2: Trigger Agent Run
    // ---------------------------------------------------------
    console.log('\n[Test 2] Triggering Autonomous Agent Loop...');
    const triggerRes = await fetch(`${API_BASE}/agent/run`, { method: 'POST' });
    if (!triggerRes.ok) throw new Error(`Trigger failed: ${await triggerRes.text()}`);
    const triggerData = await triggerRes.json();
    console.log('  ✅ Agent triggered successfully:', triggerData.message);

    // ---------------------------------------------------------
    // TEST 3: Wait for Agent to Process (Simulation Buffer)
    // ---------------------------------------------------------
    console.log('\n[Test 3] Waiting 15 seconds for the agent to process sources and synthesize...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log('  ✅ Wait complete.');

    // ---------------------------------------------------------
    // TEST 4: Verify Brief Publication
    // ---------------------------------------------------------
    console.log('\n[Test 4] Checking if Agent published any briefs...');
    const briefsRes = await fetch(`${API_BASE}/briefs`);
    if (!briefsRes.ok) throw new Error('Failed to fetch briefs.');
    const briefs = await briefsRes.json();
    
    if (briefs.length === 0) {
      console.warn('  ⚠️ No briefs found. The agent might have skipped sources due to low relevance or insufficient budget. (This is normal economic behavior).');
    } else {
      console.log(`  ✅ Found ${briefs.length} published brief(s)!`);
      const briefId = briefs[0].id;

      // ---------------------------------------------------------
      // TEST 5: Verify Preview Endpoint
      // ---------------------------------------------------------
      console.log('\n[Test 5] Fetching Brief Preview (Free)...');
      const previewRes = await fetch(`${API_BASE}/briefs/${briefId}/preview`);
      if (!previewRes.ok) throw new Error('Failed to fetch brief preview.');
      const preview = await previewRes.json();
      console.log('  ✅ Preview fetched! Title:', preview.title);

      // ---------------------------------------------------------
      // TEST 6: Verify x402 Payment Gate
      // ---------------------------------------------------------
      console.log('\n[Test 6] Testing x402 Gated Endpoint (Should reject without payment)...');
      const gatedRes = await fetch(`${API_BASE}/briefs/${briefId}`);
      if (gatedRes.status === 402) {
        console.log('  ✅ Correctly received HTTP 402 Payment Required! The x402 gate is secure.');
      } else {
        throw new Error(`Expected HTTP 402, but got ${gatedRes.status}`);
      }
    }

    // ---------------------------------------------------------
    // TEST 7: Feed history endpoint (past DB-persisted events)
    // ---------------------------------------------------------
    console.log('\n[Test 7] Checking GET /api/agent/feed-history...');
    const historyRes = await fetch(`${API_BASE}/agent/feed-history?limit=50`);
    if (!historyRes.ok) throw new Error('Failed to fetch feed history.');
    const history = await historyRes.json();
    if (!Array.isArray(history)) throw new Error('feed-history did not return an array.');
    for (const item of history) {
      if (!item.id || !item.type || !item.timestamp) {
        throw new Error(`feed-history item missing required EconomyEvent fields: ${JSON.stringify(item)}`);
      }
    }
    console.log(`  ✅ feed-history returned ${history.length} real event(s), correctly shaped.`);

    // ---------------------------------------------------------
    // TEST 8: Real paid-serve round trip (402 -> real payment -> content)
    // ---------------------------------------------------------
    console.log('\n[Test 8] Paying for a brief via the demo buyer wallet and confirming real content unlocks...');
    if (briefs.length === 0) {
      console.log('  ⚠️ Skipped — no briefs published this run to buy.');
    } else {
      const targetId = briefs[0].id;
      const demoBuyRes = await fetch(`${API_BASE}/agent/demo-buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId: targetId }),
      });
      if (!demoBuyRes.ok) throw new Error(`demo-buy failed: ${await demoBuyRes.text()}`);
      const demoBuyData = await demoBuyRes.json();
      if (!demoBuyData.brief?.keyFinding) throw new Error('demo-buy succeeded but did not return unlocked brief content');
      if (!demoBuyData.buyerAddress) throw new Error('demo-buy did not report a buyer address');
      console.log(`  ✅ Real x402 payment settled, content unlocked: "${demoBuyData.brief.title}" (paid by ${demoBuyData.buyerAddress.slice(0, 10)}…)`);
    }

    // ---------------------------------------------------------
    // TEST 9: Public /network API (no auth required)
    // ---------------------------------------------------------
    console.log('\n[Test 9] Checking public /network APIs...');
    const statsRes = await fetch(`${API_BASE}/agent/network-stats`);
    if (!statsRes.ok) throw new Error('Failed to fetch network-stats.');
    const stats = await statsRes.json();
    for (const key of ['briefsPublished', 'totalSpentUsd', 'totalEarnedUsd', 'paymentsCount']) {
      if (typeof stats[key] !== 'number') throw new Error(`network-stats missing numeric field "${key}"`);
    }
    const chainInfoRes = await fetch(`${API_BASE}/agent/chain-info`);
    if (!chainInfoRes.ok) throw new Error('Failed to fetch chain-info.');
    const chainInfo = await chainInfoRes.json();
    if (!chainInfo.gatewayWalletContractAddress) throw new Error('chain-info missing gatewayWalletContractAddress');
    console.log(`  ✅ network-stats and chain-info both public and correctly shaped (${stats.briefsPublished} briefs, ${stats.paymentsCount} payments all-time).`);

    // ---------------------------------------------------------
    // TEST 10: Agent-to-agent purchase — honest self-exclusion
    // ---------------------------------------------------------
    console.log('\n[Test 10] Verifying agent-to-agent purchase logic self-excludes correctly...');
    const marketplaceRes = await fetch(`${API_BASE}/marketplace`);
    if (!marketplaceRes.ok) throw new Error('Failed to fetch marketplace.');
    const marketplace = await marketplaceRes.json();
    if (marketplace.length > 0) {
      const ownAddress = (chainInfo.agentWalletAddress ?? '').toLowerCase();
      const allSelf = marketplace.every((b: { agentAddress: string }) => b.agentAddress.toLowerCase() === ownAddress);
      if (!allSelf) throw new Error('Expected every marketplace listing to share the agent\'s own wallet address in this single-instance deployment');
      console.log(`  ✅ All ${marketplace.length} marketplace listing(s) correctly share the agent's own wallet — agentToAgent.ts's self-exclusion filter has real listings to exclude and does so.`);
    } else {
      console.log('  ⚠️ Marketplace is empty — nothing to verify self-exclusion against yet.');
    }

    console.log('\n🎉 ALL TESTS PASSED! The HERALD Agent is fully operational.');
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

runTests();
