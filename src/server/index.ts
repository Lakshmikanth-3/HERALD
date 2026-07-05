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

// The Vercel deployment is frontend-only (see README § Known Limitations) —
// viewers run this Express server locally and point their browser at the
// public Vercel URL to see live data. That means requests legitimately
// arrive with `Origin: https://lepton-blue.vercel.app` (or a preview-deploy
// hash like `lepton-<hash>-<team>.vercel.app`), not just localhost. Without
// allowing those origins, the browser silently blocks every response
// (BackendStatusBanner then reports "not reachable" even though the server
// is up and directly curl-able, since curl doesn't enforce CORS).
const explicitOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];
const VERCEL_ORIGIN_PATTERN = /^https:\/\/lepton(-[a-z0-9]+)*\.vercel\.app$/;

app.use(cors({
  origin(requestOrigin, callback) {
    if (!requestOrigin || explicitOrigins.includes(requestOrigin) || VERCEL_ORIGIN_PATTERN.test(requestOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
    }
  },
}));
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
