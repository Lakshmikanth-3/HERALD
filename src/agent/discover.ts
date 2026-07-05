// HERALD — Source Discovery
// Uses real free public RSS feeds and news APIs — no mocks, no hardcoded content.
// Sources: RSS feeds from BBC, Reuters, The Guardian, Al Jazeera, Hacker News.
// Topic filtering is done via keyword matching on titles/descriptions.

import RSSParser from 'rss-parser';
import type { Source } from '../shared/types';

const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'HERALD-Agent/1.0 (+https://herald.agent)' },
});

// Real, publicly accessible RSS feeds by category
const RSS_FEEDS: Record<string, string[]> = {
  technology: [
    'https://feeds.feedburner.com/TechCrunch',
    'https://www.wired.com/feed/rss',
    'https://hnrss.org/frontpage',
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://www.theverge.com/rss/index.xml',
  ],
  finance: [
    'https://feeds.bloomberg.com/markets/news.rss',
    'https://www.ft.com/?format=rss',
    'https://feeds.reuters.com/reuters/businessNews',
    'https://rss.cnn.com/rss/money_latest.rss',
  ],
  politics: [
    'https://feeds.reuters.com/Reuters/PoliticsNews',
    'https://rss.politico.com/politics-news.xml',
    'https://www.theguardian.com/politics/rss',
    'https://feeds.bbci.co.uk/news/politics/rss.xml',
  ],
  science: [
    'https://www.nature.com/nature.rss',
    'https://feeds.newscientist.com/full-rss',
    'https://www.sciencedaily.com/rss/all.xml',
  ],
  ai: [
    'https://hnrss.org/frontpage?q=AI+OR+LLM+OR+machine+learning',
    'https://feeds.feedburner.com/TechCrunch',
    'https://www.technologyreview.com/feed/',
  ],
  crypto: [
    'https://cointelegraph.com/rss',
    'https://coindesk.com/arc/outboundfeeds/rss/',
    'https://decrypt.co/feed',
  ],
  general: [
    'https://feeds.bbci.co.uk/news/rss.xml',
    'https://feeds.reuters.com/reuters/topNews',
    'https://www.theguardian.com/world/rss',
    'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    'https://al-monitor.com/contents/rss.xml',
  ],
};

function detectCategory(topic: string): string[] {
  const t = topic.toLowerCase();
  const categories: string[] = ['general'];
  // Word STEMS, not whole words — "trade" as a whole word never matches
  // "trading" (different suffix), so a topic like "explain the trading
  // concept" silently missed every category and fell through to the
  // generic 'general' feeds. Matching the shared root (e.g. "trad" covers
  // trade/trading/trader/trades) is what these checks actually intend.
  if (/\bai\b|artificial intelligence|machine learning|llm|gpt|claude|gemini/.test(t)) categories.unshift('ai', 'technology');
  if (/crypto|bitcoin|ethereum|defi|blockchain|usdc|web3/.test(t)) categories.unshift('crypto');
  if (/financ|market|stock|econom|trad|invest/.test(t)) categories.unshift('finance');
  if (/politic|elect|govern|regul|polic|\blaw\b/.test(t)) categories.unshift('politics');
  if (/scien|research|climat|environ|health|medic/.test(t)) categories.unshift('science');
  if (/tech|softw|startup|develop|cloud|cyber/.test(t)) categories.unshift('technology');
  return [...new Set(categories)];
}

function estimateWordCount(text: string): number {
  return text ? text.trim().split(/\s+/).length * 8 : 300; // RSS items ~ article length
}

interface PaidSourceListing {
  id: string;
  title: string;
  domain: string;
  priceUsd: number;
  wordCount: number;
  publishedAt: number;
}

// HERALD's own x402-gated original content (see server/routes/sources.ts).
// Unlike the free RSS feeds above, these genuinely respond HTTP 402 — this is
// what exercises buyer.ts's real payment path instead of always reading for free.
async function discoverPaidSources(): Promise<Source[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${process.env.HERALD_API_PORT ?? '3001'}`;
  try {
    // This is a self-referential call to our own server, which can hit a
    // transient "fetch failed" (observed in practice under concurrent RSS
    // fetch load) — one retry is enough since it's the same process.
    let res: Response;
    try {
      res = await fetch(`${apiBase}/api/sources`);
    } catch {
      res = await fetch(`${apiBase}/api/sources`);
    }
    if (!res.ok) return [];
    const listings = (await res.json()) as PaidSourceListing[];
    return listings.map((s) => ({
      url: `${apiBase}/api/sources/${s.id}`,
      title: s.title,
      domain: 'herald-originals',
      ageHours: (Date.now() - s.publishedAt * 1000) / (1000 * 3600),
      wordCount: s.wordCount,
      description: s.title,
    }));
  } catch (err) {
    console.warn(`[discover] Paid sources unavailable: ${(err as Error).message}`);
    return [];
  }
}

export async function discoverSources(topic: string): Promise<Source[]> {
  const categories = detectCategory(topic);
  const feeds: string[] = [];

  for (const cat of categories.slice(0, 3)) {
    const catFeeds = RSS_FEEDS[cat] ?? [];
    feeds.push(...catFeeds.slice(0, 3));
  }

  const uniqueFeeds = [...new Set(feeds)];
  const topicKeywords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  const sources: Source[] = [];

  await Promise.allSettled(
    uniqueFeeds.map(async (feedUrl) => {
      try {
        const feed = await parser.parseURL(feedUrl);
        const domain = new URL(feedUrl).hostname.replace('www.', '').replace('feeds.', '');

        for (const item of feed.items.slice(0, 10)) {
          const title = item.title ?? '';
          const description = item.contentSnippet ?? item.content ?? item.summary ?? '';
          const link = item.link ?? '';
          if (!link || !title) continue;

          const text = (title + ' ' + description).toLowerCase();
          const hasKeyword = topicKeywords.some(kw => text.includes(kw));
          if (!hasKeyword && sources.length > 20) continue; // Only skip irrelevant if we have enough

          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
          const ageHours = (Date.now() - pubDate.getTime()) / (1000 * 3600);

          sources.push({
            url: link,
            title,
            domain,
            ageHours,
            wordCount: estimateWordCount(description),
            description: description.slice(0, 300),
          });
        }
      } catch (err) {
        // Individual feed failures are non-fatal — skip and continue
        console.warn(`[discover] Feed failed: ${feedUrl} — ${(err as Error).message}`);
      }
    })
  );

  const paidSources = await discoverPaidSources();

  // Deduplicate by URL
  const seen = new Set<string>();
  return [...paidSources, ...sources].filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
