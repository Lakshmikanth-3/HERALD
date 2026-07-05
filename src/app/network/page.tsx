'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import HeraldNav from '../components/HeraldNav'
import SSEListener from '../components/SSEListener'
import LiveFeed, { buildFeedEntry } from '../economy/LiveFeed'
import PaymentTicker from '../economy/PaymentTicker'
import CycleTimeline, { type CycleReport } from './CycleTimeline'
import FlowGraph from '../economy/FlowGraph'
import { addressUrl, shortAddr } from '../../lib/explorer'
import { useCountUp } from '../../lib/useCountUp'
import type { EconomyEvent } from '../../shared/types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface NetworkStats {
  briefsPublished: number
  totalSpentUsd: number
  totalEarnedUsd: number
  totalSourceSalesUsd: number
  paymentsCount: number
  sourcesPurchased: number
}

interface ChainInfo {
  agentWalletAddress: string | null
}

type FeedEntry = NonNullable<ReturnType<typeof buildFeedEntry>>

export default function NetworkPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null)
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null)
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([])
  const [allEvents, setAllEvents] = useState<EconomyEvent[]>([])
  const [flowHistory, setFlowHistory] = useState<EconomyEvent[]>([])
  const [cycles, setCycles] = useState<CycleReport[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, chainRes, historyRes, cyclesRes] = await Promise.all([
          fetch(`${API}/api/agent/network-stats`),
          fetch(`${API}/api/agent/chain-info`),
          fetch(`${API}/api/agent/feed-history?limit=30`),
          fetch(`${API}/api/agent/cycles?limit=20`),
        ])
        if (statsRes.ok) setStats(await statsRes.json())
        if (chainRes.ok) setChainInfo(await chainRes.json())
        if (historyRes.ok) {
          const history = await historyRes.json() as EconomyEvent[]
          setFlowHistory(history)
          setFeedEntries(history.map(buildFeedEntry).filter((e): e is FeedEntry => e !== null).map(e => ({ ...e, historical: true })))
        }
        if (cyclesRes.ok) setCycles(await cyclesRes.json())
      } catch (e) {
        console.error('Failed to load network stats:', e)
      }
    }
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [])

  const handleEvent = useCallback((event: EconomyEvent) => {
    setAllEvents(prev => [...prev, event].slice(-200))
    const entry = buildFeedEntry(event)
    if (entry) setFeedEntries(prev => [entry, ...prev].slice(0, 60))
  }, [])

  const totalVolume = stats
    ? stats.totalSpentUsd + stats.totalEarnedUsd + stats.totalSourceSalesUsd
    : 0

  const tickerEvents = useMemo(() => [...flowHistory, ...allEvents], [flowHistory, allEvents])

  return (
    <div className="ambient-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SSEListener onEvent={handleEvent} />
      <HeraldNav />
      <PaymentTicker events={tickerEvents} />

      <div style={{ padding: '20px 20px 0', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <h1 className="font-display" style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
          HERALD Network
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, maxWidth: 640 }}>
          A public, read-only look at HERALD&apos;s real x402 economy — no login, no controls.
          Every number below comes from the database or a live API call.
        </p>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
          <StatTile label="Briefs published" value={stats?.briefsPublished ?? 0} format={n => String(Math.round(n))} color="var(--ai-purple)" delay={0} />
          <StatTile label="Sources purchased" value={stats?.sourcesPurchased ?? 0} format={n => String(Math.round(n))} color="var(--usdc-blue)" delay={60} />
          <StatTile label="Total spent" value={stats?.totalSpentUsd ?? 0} format={n => `$${n.toFixed(4)}`} color="var(--usdc-blue)" delay={120} />
          <StatTile label="Total earned" value={stats?.totalEarnedUsd ?? 0} format={n => `$${n.toFixed(4)}`} color="var(--earn-mint)" delay={180} />
          <StatTile label="Total volume moved" value={totalVolume} format={n => `$${n.toFixed(4)}`} color="var(--text-primary)" delay={240} />
        </div>

        {chainInfo?.agentWalletAddress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 12, color: 'var(--text-muted)' }}>
            Agent wallet:
            <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{shortAddr(chainInfo.agentWalletAddress)}</span>
            <a href={addressUrl(chainInfo.agentWalletAddress)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--usdc-blue)', textDecoration: 'none' }}>
              Arc explorer ↗
            </a>
            <span style={{ color: 'var(--border)' }}>·</span>
            <a href="/how-it-works" style={{ color: 'var(--usdc-blue)', textDecoration: 'none' }}>Full verification page →</a>
          </div>
        )}
      </div>

      <div className="network-grid" style={{
        flex: 1, padding: '0 20px 20px', maxWidth: 1200, margin: '0 auto', width: '100%',
      }}>
        {/* Fixed height, not minHeight — the Recent Activity card's
            overflow-y:auto (below) needs a definite height to clip
            against, otherwise it grows to fit every feed entry at full
            height instead of scrolling, and since CSS Grid stretches both
            columns in a row to match the tallest one, the FlowGraph's
            canvas inherited that same runaway height, rendering its nodes
            far outside the visible viewport. */}
        <div className="animate-stagger-in" style={{ minWidth: 0, height: 480, animationDelay: '300ms' }}>
          <FlowGraph events={allEvents} history={flowHistory} />
        </div>
        <div className="card animate-stagger-in" style={{ minWidth: 0, height: 480, display: 'flex', flexDirection: 'column', animationDelay: '360ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              RECENT ACTIVITY
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <LiveFeed entries={feedEntries} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <CycleTimeline cycles={cycles} />
      </div>
    </div>
  )
}

function StatTile({ label, value, format, color, delay }: { label: string; value: number; format: (n: number) => string; color: string; delay: number }) {
  const animated = useCountUp(value)
  return (
    <div
      className="card card-hover stat-tile-accent animate-stagger-in"
      style={{ padding: '14px 16px', animationDelay: `${delay}ms`, '--tile-accent': color } as React.CSSProperties}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color }}>{format(animated)}</div>
    </div>
  )
}
