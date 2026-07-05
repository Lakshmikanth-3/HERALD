// HERALD — Marketplace Routes
// Lists all available briefs from all agents for purchase

import { Router, Request, Response } from 'express';
import { getAllBriefs } from '../../shared/db';

const router = Router();

// GET /api/marketplace — all published briefs available for purchase
router.get('/', (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10), 50);
  const topic = req.query.topic as string | undefined;

  // Read the real 1Claw agent ID from environment (set during vault seeding)
  const agentId = process.env.ONECLAW_AGENT_ID ?? 'unknown';
  const walletAddress = process.env.HERALD_WALLET_ADDRESS ?? 'wallet-not-configured';

  let briefs = getAllBriefs(limit);
  if (topic) {
    briefs = briefs.filter(b => b.topic.toLowerCase().includes(topic.toLowerCase()));
  }

  const marketplace = briefs.map(b => ({
    id: b.id,
    title: b.title,
    topic: b.topic,
    agentId,
    agentAddress: walletAddress,
    sourcesCount: b.sources.length,
    priceUsd: b.priceUsd,
    purchases: b.purchases,
    publishedAt: b.publishedAt,
    confidence: b.confidence,
    keyFindingTeaser: b.keyFinding.slice(0, 150) + (b.keyFinding.length > 150 ? '...' : ''),
  }));

  res.json(marketplace);
});

export default router;
