// HERALD Shared Types

export interface AgentConfig {
  topic: string;
  weeklyBudgetUsd: number;
  briefPriceUsd: number;
  walletId: string;
  walletAddress: string;
}

export interface Source {
  url: string;
  title: string;
  domain: string;
  ageHours: number;
  wordCount: number;
  description?: string;
}

export interface ScoredSource extends Source {
  relevanceScore: number;
  willPay: boolean;
  maxPayUsd: number;
}

export interface PaymentRecord {
  id: string;
  // 'source_sale' = revenue to the sources treasury (a separate wallet/actor
  // from the agent's own wallet) — excluded from the agent's own daily P&L.
  // 'deposit' = a real on-chain Circle Gateway deposit (approve + deposit),
  // not a purchase — also excluded from getDailyBalance's spent/earned sums.
  type: 'sent' | 'received' | 'skipped' | 'source_sale' | 'deposit';
  url?: string;
  briefId?: string;
  amountUsd: number;
  destination?: string;    // source domain or 'Marketplace'
  source?: string;         // buyer agent ID or address
  reason: string;
  timestamp: number;
  // Real on-chain settlement tx hash/id from Circle's Gateway facilitator
  // (settleResult.transaction), when available — lets the UI link straight
  // to the Arc testnet explorer as verifiable proof of payment.
  txHash?: string;
}

// A genuine, originally-authored piece of content HERALD hosts and charges
// agents to read via a real x402 gate (src/server/routes/sources.ts) —
// settled to a separate treasury wallet, not the agent's own.
export interface PaidSource {
  id: string;
  title: string;
  domain: string;
  content: string;
  priceUsd: number;
  wordCount: number;
  publishedAt: number;
  revenue: number;
  purchases: number;
}

export interface Brief {
  id: string;
  title: string;
  topic: string;
  keyFinding: string;
  supportingPoints: string[];
  gaps: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sources: Array<{ url: string; title: string; cost: number }>;
  productionCost: number;
  priceUsd: number;
  publishedAt: number;
  revenue: number;
  purchases: number;
}

// Free, public metadata shape returned by GET /api/briefs and
// GET /api/briefs/:id/preview — the full Brief's `sources`/`keyFinding` are
// paid content and are never included here.
export interface BriefMetadata {
  id: string;
  title: string;
  topic: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  priceUsd: number;
  publishedAt: number;
  purchases: number;
  revenue: number;
  keyFindingTeaser: string;
  sourcesCount: number;
  productionCost: number;
}

export interface AgentBalance {
  total: number;
  spentToday: number;
  earnedToday: number;
  net: number;
}

export interface EconomyEvent {
  id: string;
  type: 'payment:sent' | 'payment:received' | 'payment:skipped' | 'brief:published' | 'agent:cycle:start' | 'agent:cycle:end' | 'agent:low-balance' | 'agent:deposit';
  data: Record<string, unknown>;
  timestamp: number;
}

export interface MarketplaceBrief {
  id: string;
  title: string;
  topic: string;
  agentId: string;
  agentAddress: string;
  sourcesCount: number;
  priceUsd: number;
  purchases: number;
  publishedAt: number;
  confidence: string;
}
