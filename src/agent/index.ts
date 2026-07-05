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
import { tryBuyRelevantBrief } from './agentToAgent';
import { wasSeenRecently, getConfig, getDailyBalance, insertPayment, insertCycleReport } from '../shared/db';
import { emit } from '../shared/events';
import type { FetchedSource } from './buyer';
import { v4 as uuidv4 } from 'uuid';

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
      insertCycleReport({
        id: uuidv4(), topic, stage: 'insufficient-balance', sourcesCount: 0, sessionSpent: 0,
        cycleMs: Date.now() - cycleStart, timestamp: Math.floor(Date.now() / 1000),
      });
      return;
    }

    // ── Step 1.5: Check for a relevant brief from another agent first ────────
    // Real x402 purchase against the marketplace if one clears the relevance
    // and budget bars — see agent/agentToAgent.ts for why this is always a
    // documented no-op in this single-instance deployment (every marketplace
    // listing shares this agent's own wallet address, so it's correctly
    // self-excluded rather than faked as a cross-agent purchase).
    emit('agent:cycle:start', { stage: 'agent-to-agent', topic });
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${process.env.HERALD_API_PORT ?? '3001'}`;
    const boughtBrief = await tryBuyRelevantBrief(topic, sessionBudget, apiBase);
    const priorFetched: FetchedSource[] = [];
    let priorSpent = 0;
    if (boughtBrief) {
      console.log(`[agent] Bought a relevant brief from another agent: "${boughtBrief.title}" ($${boughtBrief.priceUsd.toFixed(4)})`);
      priorFetched.push({
        url: `herald://marketplace/briefs/${boughtBrief.id}`,
        title: boughtBrief.title,
        content: [boughtBrief.keyFinding, ...boughtBrief.supportingPoints].join(' '),
        paidUsd: boughtBrief.priceUsd,
        wasX402: true,
      });
      priorSpent = boughtBrief.priceUsd;
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
    emit('agent:cycle:start', { stage: 'scoring', topic, sourcesCount: scoredSources.length, toPayCount: toPay.length, toSkipCount: toSkip.length });

    // Emit skipped sources to live feed (and persist so the feed history survives a restart)
    for (const s of toSkip.slice(0, 5)) {
      const reason = `Low relevance score: ${s.relevanceScore.toFixed(2)}`;
      emit('payment:skipped', {
        url: s.url,
        domain: s.domain,
        title: s.title.slice(0, 80),
        reason,
        score: s.relevanceScore,
      });
      insertPayment({
        id: uuidv4(),
        type: 'skipped',
        url: s.url,
        amountUsd: 0,
        destination: s.domain,
        reason,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    // ── Step 4: Fetch sources (respecting session budget) ─────────────────────
    let sessionSpent = priorSpent;
    const fetchedSources: FetchedSource[] = [...priorFetched];

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
      const cycleMs = Date.now() - cycleStart;
      emit('agent:cycle:end', { stage: 'no-content', topic, sessionSpent, cycleMs });
      insertCycleReport({
        id: uuidv4(), topic, stage: 'no-content', sourcesCount: 0, sessionSpent,
        cycleMs, timestamp: Math.floor(Date.now() / 1000),
      });
      return;
    }

    // ── Step 5: Synthesize ────────────────────────────────────────────────────
    emit('agent:cycle:start', { stage: 'synthesizing', sourcesCount: fetchedSources.length, topic });
    const synthesis = await synthesize(topic, fetchedSources);

    if (!synthesis) {
      console.error('[agent] Synthesis returned null');
      const cycleMs = Date.now() - cycleStart;
      emit('agent:cycle:end', { stage: 'error', error: 'Synthesis returned null', topic, sessionSpent, cycleMs });
      insertCycleReport({
        id: uuidv4(), topic, stage: 'synthesis-failed', sourcesCount: fetchedSources.length, sessionSpent,
        error: 'Synthesis returned null', cycleMs, timestamp: Math.floor(Date.now() / 1000),
      });
      return;
    }

    // ── Step 6: Publish brief ─────────────────────────────────────────────────
    const brief = await publishBrief(topic, synthesis);

    const daily = getDailyBalance();
    const cycleMs = Date.now() - cycleStart;
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
      cycleMs,
    });
    insertCycleReport({
      id: uuidv4(), topic, stage: 'complete', sourcesCount: fetchedSources.length, sessionSpent,
      briefId: brief.id, briefTitle: brief.title, briefPrice: brief.priceUsd,
      cycleMs, timestamp: Math.floor(Date.now() / 1000),
    });

    console.log(`[agent] Cycle complete — brief "${brief.title}" published at $${brief.priceUsd.toFixed(3)}`);

  } catch (err) {
    console.error('[agent] Cycle error:', (err as Error).message);
    const cycleMs = Date.now() - cycleStart;
    emit('agent:cycle:end', { stage: 'error', error: (err as Error).message, cycleMs });
    insertCycleReport({
      id: uuidv4(), topic: getConfig('topic') ?? 'unknown', stage: 'error', sourcesCount: 0, sessionSpent: 0,
      error: (err as Error).message, cycleMs, timestamp: Math.floor(Date.now() / 1000),
    });
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
