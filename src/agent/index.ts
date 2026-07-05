// HERALD — Autonomous Agent Loop
// Runs every 4 hours (or manually triggered via POST /api/agent/run)
// Implements the full cycle: balance check → discover → score → fetch → synthesize → publish

import cron from 'node-cron';
import { discoverSources } from './discover';
import { rankAndFilter, PAY_THRESHOLD } from './score';
import { fetchSource } from './buyer';
import { synthesize } from './synthesize';
import { publishBrief } from './publish';
import { checkSufficientBalance } from './wallet';
import { wasSeenRecently, getConfig, getDailyBalance } from '../shared/db';
import { emit } from '../shared/events';
import type { FetchedSource } from './buyer';

let isRunning = false;

export function startAgentScheduler(): void {
  // Run every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    await runAgentCycle();
  });
  console.log('[agent] Scheduler started — runs every 4 hours. POST /api/agent/run to trigger manually.');
}

export async function runAgentCycle(): Promise<void> {
  if (isRunning) {
    console.log('[agent] Cycle already running, skipping.');
    return;
  }

  isRunning = true;
  const cycleStart = Date.now();

  try {
    // Load agent config from database
    const topic = getConfig('topic');
    const weeklyBudget = parseFloat(getConfig('weeklyBudget') ?? '3.00');
    const briefPrice = parseFloat(getConfig('briefPrice') ?? '0.05');

    if (!topic) {
      console.log('[agent] No topic configured — waiting for deployment.');
      return;
    }

    emit('agent:cycle:start', { stage: 'starting', topic, weeklyBudget, cycleStart });
    console.log(`[agent] Starting cycle — topic: "${topic}", weeklyBudget: $${weeklyBudget}`);

    // ── Step 1: Check balance ──────────────────────────────────────────────────
    const sessionBudget = weeklyBudget / (7 * 6); // 6 sessions/day × 7 days
    const hasFunds = await checkSufficientBalance(sessionBudget);
    if (!hasFunds) {
      console.warn(`[agent] Insufficient balance for session budget $${sessionBudget.toFixed(4)}. Pausing.`);
      return;
    }

    // ── Step 2: Discover sources ──────────────────────────────────────────────
    emit('agent:cycle:start', { stage: 'discovering', topic });
    const rawSources = await discoverSources(topic);
    console.log(`[agent] Discovered ${rawSources.length} candidate sources`);

    // ── Step 3: Score and filter ──────────────────────────────────────────────
    const scoredSources = rankAndFilter(rawSources, topic)
      .filter(s => {
        if (wasSeenRecently(s.url, 24)) return false; // skip already read
        return true;
      })
      .slice(0, 20); // cap at 20 sources per session

    const toPay = scoredSources.filter(s => s.willPay);
    const toSkip = scoredSources.filter(s => !s.willPay);

    console.log(`[agent] Scoring: ${toPay.length} to fetch, ${toSkip.length} below threshold (${PAY_THRESHOLD})`);

    // Emit skipped sources to live feed
    for (const s of toSkip.slice(0, 5)) {
      emit('payment:skipped', {
        url: s.url,
        domain: s.domain,
        title: s.title.slice(0, 80),
        reason: `Low relevance score: ${s.relevanceScore.toFixed(2)}`,
        score: s.relevanceScore,
      });
    }

    // ── Step 4: Fetch sources (respecting session budget) ─────────────────────
    let sessionSpent = 0;
    const fetchedSources: FetchedSource[] = [];

    for (const source of toPay) {
      if (sessionSpent >= sessionBudget) {
        console.log(`[agent] Session budget $${sessionBudget.toFixed(4)} reached, stopping fetches`);
        break;
      }

      const fetched = await fetchSource(source, sessionBudget - sessionSpent);
      if (fetched) {
        fetchedSources.push(fetched);
        sessionSpent += fetched.paidUsd;
      }

      // Small delay between fetches (rate limiting)
      await sleep(500);
    }

    console.log(`[agent] Fetched ${fetchedSources.length} sources, spent $${sessionSpent.toFixed(4)}`);

    if (fetchedSources.length === 0) {
      console.log('[agent] No sources fetched — skipping synthesis.');
      emit('agent:cycle:end', { stage: 'no-content', topic, sessionSpent, cycleMs: Date.now() - cycleStart });
      return;
    }

    // ── Step 5: Synthesize ────────────────────────────────────────────────────
    emit('agent:cycle:start', { stage: 'synthesizing', sourcesCount: fetchedSources.length, topic });
    const synthesis = await synthesize(topic, fetchedSources);

    if (!synthesis) {
      console.error('[agent] Synthesis returned null');
      return;
    }

    // ── Step 6: Publish brief ─────────────────────────────────────────────────
    const brief = await publishBrief(topic, synthesis);

    const daily = getDailyBalance();
    emit('agent:cycle:end', {
      stage: 'complete',
      topic,
      briefId: brief.id,
      briefTitle: brief.title,
      sourcesCount: fetchedSources.length,
      sessionSpent,
      briefPrice: brief.priceUsd,
      dailySpent: daily.spentToday,
      dailyEarned: daily.earnedToday,
      cycleMs: Date.now() - cycleStart,
    });

    console.log(`[agent] Cycle complete — brief "${brief.title}" published at $${brief.priceUsd.toFixed(3)}`);

  } catch (err) {
    console.error('[agent] Cycle error:', (err as Error).message);
    emit('agent:cycle:end', { stage: 'error', error: (err as Error).message });
  } finally {
    isRunning = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isAgentRunning(): boolean {
  return isRunning;
}
