// HERALD — Express API Server entry point

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import express from 'express';
import cors from 'cors';
import agentRoutes from './routes/agent';
import briefsRoutes from './routes/briefs';
import marketplaceRoutes from './routes/marketplace';
import configRoutes from './routes/config';
import sourcesRoutes from './routes/sources';
import { startAgentScheduler } from '../agent/index';

const app = express();
const PORT = parseInt(process.env.HERALD_API_PORT ?? '3001', 10);

const origin = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001'];
app.use(cors({ origin }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/agent', agentRoutes);
app.use('/api/briefs', briefsRoutes);    // x402-gated individual briefs
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/config', configRoutes);
app.use('/api/sources', sourcesRoutes);  // x402-gated original content the agent buys

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: 'HERALD', version: '1.0.0', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[server] HERALD API running on http://localhost:${PORT}`);
  // Start the autonomous agent scheduler
  startAgentScheduler();
});

export default app;
