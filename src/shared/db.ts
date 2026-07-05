// HERALD — SQLite Database Layer
// Real database: no mocks, no in-memory fallbacks

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Brief, PaymentRecord, AgentConfig, PaidSource } from './types';

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
  `);
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
    INSERT INTO payments (id, type, url, brief_id, amount_usd, destination, source, reason, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payment.id, payment.type, payment.url ?? null, payment.briefId ?? null,
    payment.amountUsd, payment.destination ?? null, payment.source ?? null,
    payment.reason, payment.timestamp
  );
}

export function getRecentPayments(limit = 50): PaymentRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM payments ORDER BY timestamp DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  return rows.map(row => ({
    id: row.id as string,
    type: row.type as 'sent' | 'received' | 'skipped',
    url: row.url as string | undefined,
    briefId: row.brief_id as string | undefined,
    amountUsd: row.amount_usd as number,
    destination: row.destination as string | undefined,
    source: row.source as string | undefined,
    reason: row.reason as string,
    timestamp: row.timestamp as number,
  }));
}

export function getDailyBalance(): { spentToday: number; earnedToday: number } {
  const db = getDb();
  const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const sent = db.prepare(`SELECT COALESCE(SUM(amount_usd), 0) as total FROM payments WHERE type = 'sent' AND timestamp >= ?`).get(startOfDay) as { total: number };
  const received = db.prepare(`SELECT COALESCE(SUM(amount_usd), 0) as total FROM payments WHERE type = 'received' AND timestamp >= ?`).get(startOfDay) as { total: number };
  return { spentToday: sent.total, earnedToday: received.total };
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
