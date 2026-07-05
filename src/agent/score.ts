// HERALD — Relevance Scoring
// Transparent, rule-based scoring (not a black box)
// as specified in the PRD Section 6.1

import type { Source, ScoredSource } from '../shared/types';

// Trusted domain quality scores (0.0–1.0)
const TRUSTED_DOMAINS: Record<string, number> = {
  'reuters.com': 0.95,
  'ft.com': 0.93,
  'bloomberg.com': 0.93,
  'wsj.com': 0.92,
  'theguardian.com': 0.88,
  'bbc.co.uk': 0.88,
  'bbci.co.uk': 0.88,
  'nature.com': 0.95,
  'nytimes.com': 0.90,
  'techcrunch.com': 0.80,
  'wired.com': 0.82,
  'arstechnica.com': 0.85,
  'theverge.com': 0.78,
  'technologyreview.com': 0.88,
  'sciencedaily.com': 0.85,
  'cointelegraph.com': 0.72,
  'coindesk.com': 0.75,
  'decrypt.co': 0.70,
  'politico.com': 0.85,
  'ycombinator.com': 0.80,
  'news.ycombinator.com': 0.80,
  'herald-originals': 0.85, // HERALD's own real x402-gated original content
};

const PAY_THRESHOLD = 0.50; // Pay if relevance > 0.50

function keywordOverlap(text: string, topic: string): number {
  const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const textLower = text.toLowerCase();
  const matches = topicWords.filter(w => textLower.includes(w));
  return topicWords.length > 0 ? matches.length / topicWords.length : 0;
}

function freshnessScore(ageHours: number): number {
  // Exponential decay: 100% fresh at 0h, ~37% at 48h, ~5% at 144h
  return Math.exp(-ageHours / 48);
}

function domainScore(domain: string): number {
  for (const [key, score] of Object.entries(TRUSTED_DOMAINS)) {
    if (domain.includes(key)) return score;
  }
  return 0.55; // Unknown domains get a moderate score
}

function lengthScore(wordCount: number): number {
  return Math.min(wordCount / 1000, 1.0); // penalizes stubs < 1000 words
}

export function scoreSource(source: Source, topic: string): ScoredSource {
  const titleText = source.title + ' ' + (source.description ?? '');
  const relevance = keywordOverlap(titleText, topic);
  const freshness = freshnessScore(source.ageHours);
  const domain = domainScore(source.domain);
  const length = lengthScore(source.wordCount);

  // Weighted combination (matches PRD §6.1)
  const score = (relevance * 0.50) + (freshness * 0.20) + (domain * 0.20) + (length * 0.10);

  const willPay = score >= PAY_THRESHOLD;

  return {
    ...source,
    relevanceScore: score,
    willPay,
    maxPayUsd: willPay ? maxPayForSource(score, 0.01) : 0,
  };
}

function maxPayForSource(relevanceScore: number, sessionBudgetRemaining: number): number {
  const base = 0.001;
  const ceiling = Math.min(0.01, sessionBudgetRemaining * 0.2);
  return base + (relevanceScore - PAY_THRESHOLD) * ceiling;
}

export function rankAndFilter(sources: Source[], topic: string): ScoredSource[] {
  return sources
    .map(s => scoreSource(s, topic))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export { PAY_THRESHOLD };
