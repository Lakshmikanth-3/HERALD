// HERALD — Google Gemini Synthesis (free tier)
// Uses the real Google Generative AI API (gemini-flash-latest, free tier) for
// brief synthesis.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey } from './secrets';
import type { FetchedSource } from './buyer';
import { emit } from '../shared/events';

export interface SynthesisResult {
  title: string;
  keyFinding: string;
  supportingPoints: string[];
  gaps: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sources: Array<{ url: string; title: string; cost: number }>;
  productionCost: number;
}

const SYNTHESIS_PROMPT = `You are HERALD, an autonomous research agent. You have read the following sources on the topic: "{{TOPIC}}".

Synthesize them into a concise, factual research brief.

RULES:
- Maximum 400 words total
- Do not reproduce more than 12 consecutive words from any single source
- Be objective and cite evidence
- Identify gaps or uncertainties in the available information
- Rate your confidence: HIGH (multiple corroborating sources), MEDIUM (limited sources), LOW (single source or conflicting info)

OUTPUT FORMAT — respond ONLY with valid JSON, no markdown, no code fences:
{
  "title": "Brief, punchy headline (max 10 words)",
  "keyFinding": "The single most important finding in 2-3 sentences",
  "supportingPoints": ["Point 1", "Point 2", "Point 3"],
  "gaps": ["Gap or uncertainty 1", "Gap or uncertainty 2"],
  "confidence": "HIGH|MEDIUM|LOW"
}

SOURCES:
{{SOURCES}}`;

export async function synthesize(
  topic: string,
  sources: FetchedSource[]
): Promise<SynthesisResult | null> {
  if (sources.length === 0) {
    console.warn('[synthesize] No sources to synthesize');
    return null;
  }

  const geminiKey = await getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(geminiKey);
  // 'gemini-1.5-flash' was retired from the v1beta API (confirmed via a live
  // ListModels call on 2026-07-04) — 'gemini-flash-latest' is a stable alias
  // that tracks whatever the current flash release is, avoiding this same
  // staleness problem again.
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

  const sourcesText = sources
    .map((s, i) =>
      `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content.slice(0, 2000)}`
    )
    .join('\n\n---\n\n');

  const prompt = SYNTHESIS_PROMPT
    .replace('{{TOPIC}}', topic)
    .replace('{{SOURCES}}', sourcesText);

  try {
    emit('agent:cycle:start', { stage: 'synthesis', sourcesCount: sources.length, topic });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    let parsed: {
      title: string;
      keyFinding: string;
      supportingPoints: string[];
      gaps: string[];
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    };

    try {
      // Strip any accidental markdown code fences
      const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new Error(`Gemini returned non-JSON response: ${text.slice(0, 200)}`);
    }

    const productionCost = sources.reduce((sum, s) => sum + s.paidUsd, 0);

    return {
      title: parsed.title,
      keyFinding: parsed.keyFinding,
      supportingPoints: parsed.supportingPoints,
      gaps: parsed.gaps,
      confidence: parsed.confidence,
      sources: sources.map(s => ({ url: s.url, title: s.title, cost: s.paidUsd })),
      productionCost,
    };
  } catch (err) {
    console.error('[synthesize] Gemini error:', (err as Error).message);
    throw err;
  }
}

// floorUsd is the "Minimum price per brief" value the user sets on the Deploy
// screen — a price floor, not a fixed price. The agent never sells for less
// than the user's floor, but if the real cost-based price (2x production cost
// plus a small quality bonus) comes out higher, that's what's charged instead.
// Note: production cost is often $0 (most sources are free RSS reads), so
// costBased alone can legitimately be $0 — there's no hardcoded internal
// minimum here, otherwise the floor slider's lower range would be dead for
// exactly that common case.
export function priceBrief(productionCost: number, sourcesCount: number, floorUsd = 0.03): number {
  const targetMargin = 2.0;
  const qualityBonus = Math.log(Math.max(sourcesCount, 1)) * 0.005;
  const costBased = productionCost * targetMargin + qualityBonus;
  return Math.max(0.01, Math.min(0.20, Math.max(floorUsd, costBased)));
}
