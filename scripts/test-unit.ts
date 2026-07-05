// HERALD — Unit tests: pure logic only, no server/network/DB required.
// For real integration tests against a running server, see test-e2e.ts.

import { priceBrief } from '../src/agent/synthesize';
import { scoreSource } from '../src/agent/score';
import { formatSigned } from '../src/lib/format';
import { dedupeNewById } from '../src/lib/dedupe';
import { relevanceScore } from '../src/agent/agentToAgent';
import { groupSkips, type FeedEntry } from '../src/app/economy/LiveFeed';
import type { Source } from '../src/shared/types';

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

console.log('🧪 HERALD Unit Tests\n');

// ── priceBrief() ─────────────────────────────────────────────────────────────
console.log('[priceBrief] price floor + clamping');
assertEqual(priceBrief(0.001, 3, 0.15), 0.15, 'high floor wins over a cheap cost-based price');
assertEqual(priceBrief(0.20, 3, 0.01), 0.20, 'cost-based price clamps at the $0.20 ceiling');
assertEqual(priceBrief(0, 1, 0.005), 0.01, 'floor below $0.01 clamps up to the absolute minimum');
assert(priceBrief(0, 1, 0.03) === 0.03, 'zero production cost still respects a real floor (no hidden internal minimum)');
assert(Math.abs(priceBrief(0.02, 3, 0.01) - (0.02 * 2 + Math.log(3) * 0.005)) < 1e-9, 'cost-based formula: 2x production cost + log(sources) bonus');

// ── scoreSource() ────────────────────────────────────────────────────────────
console.log('\n[scoreSource] relevance/freshness/domain/length weighting');

const relevantSource: Source = {
  url: 'https://reuters.com/ai-regulation-brussels',
  title: 'AI regulation debate heats up in Brussels',
  domain: 'reuters.com',
  ageHours: 0,
  wordCount: 1200,
};
const relevantScored = scoreSource(relevantSource, 'AI regulation');
assert(relevantScored.relevanceScore > 0.9, `high-relevance/trusted-domain/fresh/long source scores high (got ${relevantScored.relevanceScore.toFixed(3)})`);
assert(relevantScored.willPay === true, 'high-scoring source clears the pay threshold');
assert(relevantScored.maxPayUsd > 0, 'a source willing to be paid for has a positive max pay');

const irrelevantSource: Source = {
  url: 'https://randomblog.xyz/weather',
  title: 'Local weather update',
  domain: 'randomblog.xyz',
  ageHours: 200,
  wordCount: 50,
};
const irrelevantScored = scoreSource(irrelevantSource, 'AI regulation');
assert(irrelevantScored.relevanceScore < 0.2, `low-relevance/unknown-domain/stale/short source scores low (got ${irrelevantScored.relevanceScore.toFixed(3)})`);
assertEqual(irrelevantScored.willPay, false, 'low-scoring source does not clear the pay threshold');
assertEqual(irrelevantScored.maxPayUsd, 0, 'a source not worth paying for has zero max pay');

// ── formatSigned() ───────────────────────────────────────────────────────────
console.log('\n[formatSigned] sign placement (regression test for the -$0.0369-style double-negative bug)');
assertEqual(formatSigned(0.0369), '+$0.0369', 'positive value gets a + prefix');
assertEqual(formatSigned(-0.0369), '-$0.0369', 'negative value gets a single - prefix, not a double negative');
assertEqual(formatSigned(0), '+$0.0000', 'zero is treated as non-negative (+)');
assertEqual(formatSigned(-1.5, 2), '-$1.50', 'custom decimal precision is respected');

// ── dedupeNewById() ──────────────────────────────────────────────────────────
console.log('\n[dedupeNewById] event de-duplication (regression test for the FlowGraph double-processing bug)');
{
  const seen = new Set<string>();
  const batch1 = [{ id: 'a' }, { id: 'b' }];
  const fresh1 = dedupeNewById(seen, batch1);
  assertEqual(fresh1.length, 2, 'first pass: all items are new');

  // Simulate the exact bug scenario: the same accumulated array (containing
  // already-seen items) is passed again alongside one genuinely new item.
  const batch2 = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const fresh2 = dedupeNewById(seen, batch2);
  assertEqual(fresh2.length, 1, 'second pass over an array with 2 old + 1 new item yields only the 1 new item');
  assertEqual(fresh2[0].id, 'c', 'the one new item is correctly identified');

  const fresh3 = dedupeNewById(seen, batch2);
  assertEqual(fresh3.length, 0, 'a third pass with no new items yields nothing (no re-processing)');
}

// ── relevanceScore() ─────────────────────────────────────────────────────────
console.log('\n[relevanceScore] agent-to-agent marketplace matching (src/agent/agentToAgent.ts)');
assert(
  relevanceScore('AI regulation', 'AI regulation', 'The EU is finalizing AI regulation rules') > 0.9,
  'exact-topic candidate scores near-perfect relevance'
);
assert(
  relevanceScore('AI regulation', 'weather forecast', 'Rain expected this weekend') === 0,
  'unrelated candidate scores zero relevance'
);
assert(
  relevanceScore('quantum computing breakthroughs', 'quantum computing', 'A new breakthroughs paper on qubits') >
  relevanceScore('quantum computing breakthroughs', 'quantum computing', 'A paper on qubits'),
  'a candidate matching more of the topic\'s real words scores higher than one matching fewer'
);
assertEqual(relevanceScore('a an', 'anything', 'anything'), 0, 'topic with only short (<=3 char) words yields zero — nothing to match on');

// ── groupSkips() ─────────────────────────────────────────────────────────────
console.log('\n[groupSkips] Live Feed skip-grouping (collapses runs of 3+ consecutive skips)');
{
  function skip(id: string): FeedEntry {
    return { id, type: 'payment:skipped', label: `Skipped -> ${id}`, sublabel: 'Low relevance score: 0.30', timestamp: 0 };
  }
  function paid(id: string): FeedEntry {
    return { id, type: 'payment:sent', label: `Paid -> ${id}`, sublabel: 'x402', amount: 0.001, timestamp: 0 };
  }

  const belowThreshold = groupSkips([skip('a'), skip('b'), paid('c')]);
  assertEqual(belowThreshold.length, 3, 'a run of only 2 skips is not grouped (below the 3+ threshold)');
  assert(belowThreshold.every(i => i.kind === 'entry'), 'all items render as individual entries when no run reaches 3');

  const exactlyThree = groupSkips([skip('a'), skip('b'), skip('c'), paid('d')]);
  assertEqual(exactlyThree.length, 2, 'a run of exactly 3 skips collapses into 1 group + the following real entry');
  assertEqual(exactlyThree[0].kind, 'skip-group', 'the first item is the collapsed skip group');
  if (exactlyThree[0].kind === 'skip-group') {
    assertEqual(exactlyThree[0].entries.length, 3, 'the group carries all 3 real skip entries for later expansion');
  }

  const mixedRuns = groupSkips([paid('x'), skip('a'), skip('b'), skip('c'), skip('d'), paid('y'), skip('e')]);
  assertEqual(mixedRuns.length, 4, 'a real entry, a 4-skip group, another real entry, and a lone trailing skip (below threshold) = 4 render items');
  assertEqual(mixedRuns[3].kind, 'entry', 'a trailing run of fewer than 3 skips renders as a plain entry, not a group');
}

console.log(`\n${failed === 0 ? '🎉' : '❌'} ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
