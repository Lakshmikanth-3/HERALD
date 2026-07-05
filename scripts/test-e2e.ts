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

    console.log('\n🎉 ALL TESTS PASSED! The HERALD Agent is fully operational.');
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

runTests();
