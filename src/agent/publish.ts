// HERALD — Brief Publication
// Stores brief in database, emits publication event.
// The x402 gate is applied at the Express route level (see server/routes/briefs.ts)

import { insertBrief, getConfig } from '../shared/db';
import { emit } from '../shared/events';
import { priceBrief } from './synthesize';
import type { SynthesisResult } from './synthesize';
import type { Brief } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';

export async function publishBrief(
  topic: string,
  synthesis: SynthesisResult
): Promise<Brief> {
  const id = uuidv4();
  const floorUsd = parseFloat(getConfig('briefPrice') ?? '0.03');
  const priceUsd = priceBrief(synthesis.productionCost, synthesis.sources.length, floorUsd);

  const brief: Brief = {
    id,
    title: synthesis.title,
    topic,
    keyFinding: synthesis.keyFinding,
    supportingPoints: synthesis.supportingPoints,
    gaps: synthesis.gaps,
    confidence: synthesis.confidence,
    sources: synthesis.sources,
    productionCost: synthesis.productionCost,
    priceUsd,
    publishedAt: Math.floor(Date.now() / 1000),
    revenue: 0,
    purchases: 0,
  };

  insertBrief(brief);

  emit('brief:published', {
    id,
    title: brief.title,
    topic,
    priceUsd,
    productionCost: synthesis.productionCost,
    sourcesCount: synthesis.sources.length,
    confidence: synthesis.confidence,
    briefUrl: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/briefs/${id}`,
  });

  console.log(`[publish] Brief published: "${brief.title}" — price: $${priceUsd.toFixed(3)}, cost: $${synthesis.productionCost.toFixed(4)}`);

  return brief;
}
