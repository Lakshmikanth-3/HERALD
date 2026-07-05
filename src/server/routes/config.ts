// HERALD — Config Routes
// POST /api/config — save agent topic, budget, and price config to database

import { Router, Request, Response } from 'express';
import { setConfig, getAllConfig } from '../../shared/db';

const router = Router();

// GET /api/config — return current config
router.get('/', (req: Request, res: Response) => {
  const config = getAllConfig();
  res.json(config);
});

// POST /api/config — set agent topic and budget
router.post('/', (req: Request, res: Response) => {
  const { topic, weeklyBudget, briefPrice } = req.body as {
    topic?: string;
    weeklyBudget?: number;
    briefPrice?: number;
  };

  if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
    res.status(400).json({ error: 'topic is required (min 3 characters)' });
    return;
  }
  if (weeklyBudget !== undefined && (typeof weeklyBudget !== 'number' || weeklyBudget < 0.1 || weeklyBudget > 100)) {
    res.status(400).json({ error: 'weeklyBudget must be between 0.1 and 100' });
    return;
  }
  if (briefPrice !== undefined && (typeof briefPrice !== 'number' || briefPrice < 0.01 || briefPrice > 0.50)) {
    res.status(400).json({ error: 'briefPrice must be between 0.01 and 0.50' });
    return;
  }

  setConfig('topic', topic.trim());
  if (weeklyBudget !== undefined) setConfig('weeklyBudget', String(weeklyBudget));
  if (briefPrice !== undefined) setConfig('briefPrice', String(briefPrice));

  res.json({
    message: 'Config saved',
    topic: topic.trim(),
    weeklyBudget: weeklyBudget ?? 3.00,
    briefPrice: briefPrice ?? 0.05,
  });
});

export default router;
