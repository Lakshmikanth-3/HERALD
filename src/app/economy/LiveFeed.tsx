'use client'

import type { EconomyEvent } from '../../shared/types'
import { txUrl, shortTx, isRealTxHash } from '../../lib/explorer'

interface FeedEntry {
  id: string
  type: EconomyEvent['type']
  label: string
  sublabel: string
  amount?: number
  timestamp: number
  historical?: boolean
  txHash?: string
}

interface Props {
  entries: FeedEntry[]
}

export function buildFeedEntry(event: EconomyEvent): FeedEntry | null {
  const d = event.data as Record<string, unknown>

  switch (event.type) {
    case 'payment:sent': {
      const amt = d.amountUsd as number
      return {
        id: event.id,
        type: event.type,
        label: amt > 0
          ? `Paid $${amt.toFixed(4)} → ${d.domain ?? d.url}`
          : `Read (free) → ${d.domain ?? d.url}`,
        sublabel: (d.title as string)?.slice(0, 70) ?? 'Source fetched',
        amount: amt,
        timestamp: event.timestamp,
        txHash: d.txHash as string | undefined,
      }
    }
    case 'payment:received': {
      const amt = d.amountUsd as number
      return {
        id: event.id,
        type: event.type,
        label: `Earned $${amt.toFixed(4)} ← Buyer`,
        sublabel: `Brief purchased: "${(d.briefTitle as string)?.slice(0, 55) ?? d.briefId}"`,
        amount: amt,
        timestamp: event.timestamp,
        txHash: (d.txHash as string | undefined) ?? (d.transaction as string | undefined),
      }
    }
    case 'payment:skipped':
      return {
        id: event.id,
        type: event.type,
        label: `Skipped → ${d.domain ?? d.url}`,
        sublabel: (d.reason as string) ?? 'Below threshold',
        timestamp: event.timestamp,
      }
    case 'brief:published':
      return {
        id: event.id,
        type: event.type,
        label: `Brief published at $${(d.priceUsd as number)?.toFixed(3)}`,
        sublabel: (d.title as string)?.slice(0, 70) ?? 'New research brief',
        timestamp: event.timestamp,
      }
    case 'agent:cycle:start':
      return {
        id: event.id,
        type: event.type,
        label: `Agent cycle: ${d.stage}`,
        sublabel: d.sourcesCount ? `${d.sourcesCount} sources` : `Topic: ${d.topic}`,
        timestamp: event.timestamp,
      }
    case 'agent:low-balance':
      return {
        id: event.id,
        type: event.type,
        label: `⚠ Low balance: $${(d.balance as number)?.toFixed(4)}`,
        sublabel: `Required: $${(d.required as number)?.toFixed(4)}`,
        timestamp: event.timestamp,
      }
    case 'agent:deposit':
      return {
        id: event.id,
        type: event.type,
        label: `Deposited $${(d.amountUsd as number)?.toFixed(2)} into Circle Gateway`,
        sublabel: 'Real on-chain approve + deposit',
        timestamp: event.timestamp,
        txHash: d.depositTxHash as string | undefined,
      }
    default:
      return null
  }
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function entryIcon(type: EconomyEvent['type']): { icon: string; color: string; bg: string } {
  switch (type) {
    case 'payment:received':  return { icon: '★', color: 'var(--earn-mint)',  bg: 'var(--earn-mint-dim, rgba(77,255,210,0.12))' }
    case 'payment:sent':      return { icon: '●', color: 'var(--usdc-blue)',  bg: 'var(--usdc-blue-dim, rgba(39,117,202,0.12))' }
    case 'payment:skipped':   return { icon: '○', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)' }
    case 'brief:published':   return { icon: '◆', color: 'var(--ai-purple)',  bg: 'rgba(167,139,250,0.12)' }
    case 'agent:low-balance': return { icon: '!', color: 'var(--warn-amber)', bg: 'rgba(245,158,11,0.12)' }
    case 'agent:deposit':     return { icon: '⇊', color: 'var(--usdc-blue)',  bg: 'var(--usdc-blue-dim, rgba(39,117,202,0.12))' }
    default:                  return { icon: '·', color: 'var(--text-muted)', bg: 'transparent' }
  }
}

export default function LiveFeed({ entries }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      maxHeight: '100%',
      overflowY: 'auto',
    }}>
      {entries.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          <div className="live-dot" style={{ margin: '0 auto 12px' }} />
          Waiting for agent activity…<br />
          <span style={{ fontSize: 12 }}>POST /api/agent/run to trigger the first cycle</span>
        </div>
      )}
      {entries.map((entry, i) => {
        const { icon, color, bg } = entryIcon(entry.type)
        return (
          <div
            key={entry.id}
            className={entry.historical ? undefined : 'animate-fade-in'}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              background: !entry.historical && i === 0 ? bg : 'transparent',
              opacity: entry.historical ? 0.5 : 1,
              transition: 'background 0.3s',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: bg,
              border: `1px solid ${color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color,
              flexShrink: 0,
              marginTop: 1,
            }}>
              {icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {entry.amount !== undefined && entry.amount > 0 && (
                  <span className="font-mono" style={{ color, marginRight: 4 }}>
                    {entry.type === 'payment:received' ? '+' : '-'}${entry.amount.toFixed(4)}
                  </span>
                )}
                {entry.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.sublabel}
              </div>
              {entry.txHash && (
                isRealTxHash(entry.txHash) ? (
                  <a
                    href={txUrl(entry.txHash)}
                    target="_blank" rel="noopener noreferrer"
                    className="font-mono"
                    style={{ fontSize: 11, color: 'var(--usdc-blue)', textDecoration: 'none', marginTop: 2, display: 'inline-block' }}
                    onClick={e => e.stopPropagation()}
                  >
                    tx {shortTx(entry.txHash)} ↗
                  </a>
                ) : (
                  // Circle Gateway settlement ID — real, but not an on-chain
                  // hash (Gateway batches payments for later settlement), so
                  // it isn't linked to the block explorer.
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'inline-block' }}>
                    settlement {shortTx(entry.txHash)}
                  </span>
                )
              )}
            </div>

            {/* Timestamp */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
              {timeAgo(entry.timestamp)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
