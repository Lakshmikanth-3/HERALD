// HERALD — SQLite Database Layer
// Real database: no mocks, no in-memory fallbacks

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Brief, PaymentRecord, PaidSource } from './types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'herald.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS briefs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      key_finding TEXT NOT NULL,
      supporting_points TEXT NOT NULL,  -- JSON array
      gaps TEXT NOT NULL,               -- JSON array
      confidence TEXT NOT NULL,
      sources TEXT NOT NULL,            -- JSON array
      production_cost REAL NOT NULL DEFAULT 0,
      price_usd REAL NOT NULL DEFAULT 0.05,
      published_at INTEGER NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      purchases INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,           -- 'sent' | 'received' | 'skipped'
      url TEXT,
      brief_id TEXT,
      amount_usd REAL NOT NULL DEFAULT 0,
      destination TEXT,
      source TEXT,
      reason TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources_seen (
      url TEXT PRIMARY KEY,
      last_seen INTEGER NOT NULL,
      last_paid INTEGER,
      total_paid REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS paid_sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      domain TEXT NOT NULL,
      content TEXT NOT NULL,
      price_usd REAL NOT NULL,
      word_count INTEGER NOT NULL,
      published_at INTEGER NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      purchases INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cycle_reports (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      stage TEXT NOT NULL,             -- 'complete' | 'no-content' | 'synthesis-failed' | 'insufficient-balance' | 'error'
      sources_count INTEGER NOT NULL DEFAULT 0,
      session_spent REAL NOT NULL DEFAULT 0,
      brief_id TEXT,
      brief_title TEXT,
      brief_price REAL,
      error TEXT,
      cycle_ms INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL
    );
  `);

  // tx_hash was added after the initial payments table — SQLite has no
  // "ADD COLUMN IF NOT EXISTS", so guard the ALTER with a table_info check
  // instead of a blind try/catch (which would also swallow real errors).
  const paymentsCols = db.prepare(`PRAGMA table_info(payments)`).all() as Array<{ name: string }>;
  if (!paymentsCols.some(c => c.name === 'tx_hash')) {
    db.exec(`ALTER TABLE payments ADD COLUMN tx_hash TEXT`);
  }
}

// ── Agent Config ──────────────────────────────────────────────────────────────

export function setConfig(key: string, value: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO agent_config (key, value, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()
  `).run(key, value);
}

export function getConfig(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM agent_config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function getAllConfig(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM agent_config').all() as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ── Briefs ────────────────────────────────────────────────────────────────────

export function insertBrief(brief: Brief): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO briefs (id, title, topic, key_finding, supporting_points, gaps, confidence, sources, production_cost, price_usd, published_at, revenue, purchases)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    brief.id, brief.title, brief.topic, brief.keyFinding,
    JSON.stringify(brief.supportingPoints), JSON.stringify(brief.gaps),
    brief.confidence, JSON.stringify(brief.sources),
    brief.productionCost, brief.priceUsd, brief.publishedAt,
    brief.revenue, brief.purchases
  );
}

export function getBrief(id: string): Brief | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM briefs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToBrief(row);
}

export function getAllBriefs(limit = 50): Brief[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM briefs ORDER BY published_at DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  return rows.map(rowToBrief);
}

export function incrementBriefRevenue(id: string, amountUsd: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE briefs SET revenue = revenue + ?, purchases = purchases + 1 WHERE id = ?
  `).run(amountUsd, id);
}

function rowToBrief(row: Record<string, unknown>): Brief {
  return {
    id: row.id as string,
    title: row.title as string,
    topic: row.topic as string,
    keyFinding: row.key_finding as string,
    supportingPoints: JSON.parse(row.supporting_points as string),
    gaps: JSON.parse(row.gaps as string),
    confidence: row.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
    sources: JSON.parse(row.sources as string),
    productionCost: row.production_cost as number,
    priceUsd: row.price_usd as number,
    publishedAt: row.published_at as number,
    revenue: row.revenue as number,
    purchases: row.purchases as number,
  };
}

// ── Payments ──────────────────────────────────────────────────────────────────

export function insertPayment(payment: PaymentRecord): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO payments (id, type, url, brief_id, amount_usd, destination, source, reason, timestamp, tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payment.id, payment.type, payment.url ?? null, payment.briefId ?? null,
    payment.amountUsd, payment.destination ?? null, payment.source ?? null,
    payment.reason, payment.timestamp, payment.txHash ?? null
  );
}

function rowToPaymentRecord(row: Record<string, unknown>): PaymentRecord {
  return {
    id: row.id as string,
    type: row.type as 'sent' | 'received' | 'skipped' | 'source_sale' | 'deposit' | 'withdrawal',
    url: row.url as string | undefined,
    briefId: row.brief_id as string | undefined,
    amountUsd: row.amount_usd as number,
    destination: row.destination as string | undefined,
    source: row.source as string | undefined,
    reason: row.reason as string,
    timestamp: row.timestamp as number,
    txHash: row.tx_hash as string | undefined,
  };
}

export function getRecentPayments(limit = 50): PaymentRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM payments ORDER BY timestamp DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  return rows.map(rowToPaymentRecord);
}

// Real payment receipts for one specific brief — who bought it, for how much,
// and the real on-chain settlement tx hash, so a brief's buyers are provable
// rather than just a purchases counter.
export function getBriefReceipts(briefId: string): PaymentRecord[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM payments WHERE type = 'received' AND brief_id = ? ORDER BY timestamp DESC`
  ).all(briefId) as Record<string, unknown>[];
  return rows.map(rowToPaymentRecord);
}

// Real payments the agent made for specific source URLs — lets a brief cite,
// for each source, exactly what was paid for it and the real settlement
// reference, not just the cost number already embedded in the brief.
export function getPaymentsForUrls(urls: string[]): PaymentRecord[] {
  if (urls.length === 0) return [];
  const db = getDb();
  const placeholders = urls.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM payments WHERE type = 'sent' AND url IN (${placeholders}) ORDER BY timestamp DESC`
  ).all(...urls) as Record<string, unknown>[];
  return rows.map(rowToPaymentRecord);
}

export function getDailyBalance(): { spentToday: number; earnedToday: number } {
  const db = getDb();
  const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const sent = db.prepare(`SELECT COALESCE(SUM(amount_usd), 0) as total FROM payments WHERE type = 'sent' AND timestamp >= ?`).get(startOfDay) as { total: number };
  const received = db.prepare(`SELECT COALESCE(SUM(amount_usd), 0) as total FROM payments WHERE type = 'received' AND timestamp >= ?`).get(startOfDay) as { total: number };
  return { spentToday: sent.total, earnedToday: received.total };
}

export interface NetworkStats {
  briefsPublished: number;
  totalSpentUsd: number;
  totalEarnedUsd: number;
  totalSourceSalesUsd: number;
  paymentsCount: number;
  sourcesPurchased: number;
}

// All-time aggregates for the public /network dashboard — every figure is a
// real SUM/COUNT over the payments/briefs tables, nothing estimated.
export function getNetworkStats(): NetworkStats {
  const db = getDb();
  const sum = (type: string) =>
    (db.prepare(`SELECT COALESCE(SUM(amount_usd), 0) as total FROM payments WHERE type = ?`).get(type) as { total: number }).total;
  const count = (type: string) =>
    (db.prepare(`SELECT COUNT(*) as n FROM payments WHERE type = ?`).get(type) as { n: number }).n;
  const briefsPublished = (db.prepare(`SELECT COUNT(*) as n FROM briefs`).get() as { n: number }).n;
  const paymentsCount = (db.prepare(`SELECT COUNT(*) as n FROM payments`).get() as { n: number }).n;

  return {
    briefsPublished,
    totalSpentUsd: sum('sent'),
    totalEarnedUsd: sum('received'),
    totalSourceSalesUsd: sum('source_sale'),
    paymentsCount,
    sourcesPurchased: count('sent'),
  };
}

// ── Cycle reports ─────────────────────────────────────────────────────────────
// One row per agent cycle (whatever the outcome — a published brief, no
// content, a synthesis failure, insufficient balance, or an error) so the
// Economy page can show real cycle-by-cycle history, not just the latest one.

export interface CycleReport {
  id: string;
  topic: string;
  stage: 'complete' | 'no-content' | 'synthesis-failed' | 'insufficient-balance' | 'error';
  sourcesCount: number;
  sessionSpent: number;
  briefId?: string;
  briefTitle?: string;
  briefPrice?: number;
  error?: string;
  cycleMs: number;
  timestamp: number;
}

export function insertCycleReport(report: CycleReport): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO cycle_reports (id, topic, stage, sources_count, session_spent, brief_id, brief_title, brief_price, error, cycle_ms, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.id, report.topic, report.stage, report.sourcesCount, report.sessionSpent,
    report.briefId ?? null, report.briefTitle ?? null, report.briefPrice ?? null,
    report.error ?? null, report.cycleMs, report.timestamp
  );
}

export function getRecentCycleReports(limit = 20): CycleReport[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM cycle_reports ORDER BY timestamp DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  return rows.map(row => ({
    id: row.id as string,
    topic: row.topic as string,
    stage: row.stage as CycleReport['stage'],
    sourcesCount: row.sources_count as number,
    sessionSpent: row.session_spent as number,
    // SQLite returns `null` for empty columns, not `undefined` — `as` doesn't
    // convert it, so a `!== undefined` check downstream would pass right
    // through to a null and crash on the first .toFixed() call. Coalesce here
    // instead of relying on every call site to know that.
    briefId: (row.brief_id as string | null) ?? undefined,
    briefTitle: (row.brief_title as string | null) ?? undefined,
    briefPrice: (row.brief_price as number | null) ?? undefined,
    error: (row.error as string | null) ?? undefined,
    cycleMs: row.cycle_ms as number,
    timestamp: row.timestamp as number,
  }));
}

// ── Feed history ──────────────────────────────────────────────────────────────
// Reconstructs past economy events (payments sent/received/skipped, briefs
// published) from the DB so the Economy page's Live Feed and FlowGraph never
// look empty/dead on load — only what's real and already persisted, no synthetic
// filler. Shape matches EconomyEvent exactly so the frontend can feed these
// straight into the same event-processing code paths as live SSE events.
export interface FeedHistoryItem {
  id: string;
  type: 'payment:sent' | 'payment:received' | 'payment:skipped' | 'brief:published' | 'agent:deposit' | 'agent:withdrawal';
  data: Record<string, unknown>;
  timestamp: number; // ms, to match EconomyEvent.timestamp (Date.now())
}

export function getFeedHistory(limit = 50): FeedHistoryItem[] {
  const db = getDb();
  const paymentRows = db.prepare(
    `SELECT * FROM payments WHERE type IN ('sent', 'received', 'skipped', 'deposit', 'withdrawal') ORDER BY timestamp DESC LIMIT ?`
  ).all(limit) as Record<string, unknown>[];
  const briefRows = db.prepare(
    `SELECT * FROM briefs ORDER BY published_at DESC LIMIT ?`
  ).all(limit) as Record<string, unknown>[];

  const items: FeedHistoryItem[] = [];

  for (const p of paymentRows) {
    const type = p.type as 'sent' | 'received' | 'skipped' | 'deposit' | 'withdrawal';
    const timestamp = (p.timestamp as number) * 1000;
    if (type === 'deposit') {
      items.push({
        id: p.id as string,
        type: 'agent:deposit',
        timestamp,
        data: {
          amountUsd: p.amount_usd,
          depositTxHash: p.tx_hash,
        },
      });
      continue;
    }
    if (type === 'withdrawal') {
      items.push({
        id: p.id as string,
        type: 'agent:withdrawal',
        timestamp,
        data: {
          amountUsd: p.amount_usd,
          destinationAddress: p.destination,
          txHash: p.tx_hash,
        },
      });
      continue;
    }
    if (type === 'sent') {
      items.push({
        id: p.id as string,
        type: 'payment:sent',
        timestamp,
        data: {
          url: p.url,
          domain: p.destination,
          title: p.reason,
          amountUsd: p.amount_usd,
          wasX402: (p.amount_usd as number) > 0,
          txHash: p.tx_hash,
        },
      });
    } else if (type === 'received') {
      items.push({
        id: p.id as string,
        type: 'payment:received',
        timestamp,
        data: {
          briefId: p.brief_id,
          briefTitle: p.reason,
          amountUsd: p.amount_usd,
          buyerAddress: p.source,
          txHash: p.tx_hash,
        },
      });
    } else {
      items.push({
        id: p.id as string,
        type: 'payment:skipped',
        timestamp,
        data: {
          url: p.url,
          domain: p.destination,
          reason: p.reason,
        },
      });
    }
  }

  for (const b of briefRows) {
    const sources = JSON.parse(b.sources as string) as unknown[];
    items.push({
      id: b.id as string,
      type: 'brief:published',
      timestamp: (b.published_at as number) * 1000,
      data: {
        id: b.id,
        title: b.title,
        priceUsd: b.price_usd,
        productionCost: b.production_cost,
        sourcesCount: sources.length,
        confidence: b.confidence,
      },
    });
  }

  items.sort((a, b) => b.timestamp - a.timestamp);
  return items.slice(0, limit);
}

// ── Sources Seen ──────────────────────────────────────────────────────────────

export function markSourceSeen(url: string, paid?: number): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  if (paid) {
    db.prepare(`
      INSERT INTO sources_seen (url, last_seen, last_paid, total_paid) VALUES (?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET last_seen = excluded.last_seen, last_paid = excluded.last_paid, total_paid = total_paid + excluded.total_paid
    `).run(url, now, now, paid);
  } else {
    db.prepare(`
      INSERT INTO sources_seen (url, last_seen) VALUES (?, ?)
      ON CONFLICT(url) DO UPDATE SET last_seen = excluded.last_seen
    `).run(url, now);
  }
}

export function wasSeenRecently(url: string, withinHours = 24): boolean {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - withinHours * 3600;
  const row = db.prepare('SELECT last_seen FROM sources_seen WHERE url = ? AND last_seen > ?').get(url, cutoff);
  return !!row;
}

// ── Paid Sources (real x402-gated original content, sold via routes/sources.ts) ──

export function insertPaidSource(source: PaidSource): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO paid_sources (id, title, domain, content, price_usd, word_count, published_at, revenue, purchases)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, domain = excluded.domain, content = excluded.content,
      price_usd = excluded.price_usd, word_count = excluded.word_count
  `).run(
    source.id, source.title, source.domain, source.content,
    source.priceUsd, source.wordCount, source.publishedAt,
    source.revenue, source.purchases
  );
}

export function getPaidSource(id: string): PaidSource | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM paid_sources WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToPaidSource(row);
}

export function getAllPaidSources(): PaidSource[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM paid_sources ORDER BY published_at DESC').all() as Record<string, unknown>[];
  return rows.map(rowToPaidSource);
}

export function incrementPaidSourceRevenue(id: string, amountUsd: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE paid_sources SET revenue = revenue + ?, purchases = purchases + 1 WHERE id = ?
  `).run(amountUsd, id);
}

function rowToPaidSource(row: Record<string, unknown>): PaidSource {
  return {
    id: row.id as string,
    title: row.title as string,
    domain: row.domain as string,
    content: row.content as string,
    priceUsd: row.price_usd as number,
    wordCount: row.word_count as number,
    publishedAt: row.published_at as number,
    revenue: row.revenue as number,
    purchases: row.purchases as number,
  };
}
