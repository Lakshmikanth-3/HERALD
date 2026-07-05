'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import HeraldNav from '../components/HeraldNav'
import SSEListener from '../components/SSEListener'
import LiveFeed, { buildFeedEntry } from './LiveFeed'
import BalanceCard from './BalanceCard'
import FlowGraph from './FlowGraph'
import BriefPreview from './BriefPreview'
import type { EconomyEvent, BriefMetadata } from '../../shared/types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface AgentStatus {
  configured: boolean
  isRunning: boolean
  topic: string | null
  daily: { spentToday: number; earnedToday: number }
}

interface BalanceData {
  usdcBalance: number
  spentToday: number
  earnedToday: number
}

type FeedEntry = NonNullable<ReturnType<typeof buildFeedEntry>>

export default function EconomyPage() {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [balance, setBalance] = useState<BalanceData>({ usdcBalance: 0, spentToday: 0, earnedToday: 0 })
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([])
  const [allEvents, setAllEvents] = useState<EconomyEvent[]>([])
  const [latestBrief, setLatestBrief] = useState<BriefMetadata | null>(null)
  const [triggering, setTriggering] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // Load initial status, balance, and latest brief preview (metadata only — no payment needed)
  useEffect(() => {
    async function load() {
      try {
        const [statusRes, balanceRes, briefsRes] = await Promise.all([
          fetch(`${API}/api/agent/status`),
          fetch(`${API}/api/agent/balance`),
          fetch(`${API}/api/briefs?limit=1`),   // free metadata listing
        ])
        if (statusRes.ok)  setStatus(await statusRes.json())
        if (balanceRes.ok) setBalance(await balanceRes.json())
        if (briefsRes.ok) {
          const briefs = await briefsRes.json()
          if (briefs.length > 0) {
            // Use the free /preview endpoint for the dashboard preview card
            // Full content requires x402 payment from the Library screen
            const previewRes = await fetch(`${API}/api/briefs/${briefs[0].id}/preview`)
            if (previewRes.ok) {
              setLatestBrief(await previewRes.json() as BriefMetadata)
            }
          }
        }
      } catch (e) {
        console.error('Failed to load status:', e)
      }
    }
    load()
    pollRef.current = setInterval(load, 10000)
    return () => clearInterval(pollRef.current)
  }, [])

  const handleEvent = useCallback((event: EconomyEvent) => {
    setAllEvents(prev => [event, ...prev].slice(0, 200))

    const entry = buildFeedEntry(event)
    if (entry) {
      setFeedEntries(prev => [entry, ...prev].slice(0, 60))
    }

    if (event.type === 'payment:sent') {
      const amt = (event.data.amountUsd as number) ?? 0
      setBalance(prev => ({ ...prev, spentToday: prev.spentToday + amt }))
    }
    if (event.type === 'payment:received') {
      const amt = (event.data.amountUsd as number) ?? 0
      setBalance(prev => ({ ...prev, earnedToday: prev.earnedToday + amt }))
    }
    if (event.type === 'brief:published') {
      // New brief published — reload the metadata preview from the free endpoint
      const briefId = event.data.id as string
      fetch(`${API}/api/briefs/${briefId}/preview`)
        .then(r => r.ok ? r.json() : null)
        .then(b => { if (b) setLatestBrief(b as BriefMetadata) })
    }
  }, [])

  async function triggerRun() {
    setTriggering(true)
    try {
      await fetch(`${API}/api/agent/run`, { method: 'POST' })
      setStatus(prev => prev ? { ...prev, isRunning: true } : prev)
    } finally {
      setTimeout(() => setTriggering(false), 2000)
    }
  }

  const net = balance.earnedToday - balance.spentToday

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SSEListener onEvent={handleEvent} />
      <HeraldNav topic={status?.topic ?? undefined} />

      <div className="economy-grid">

        {/* Zone A — Balance */}
        <div style={{ gridRow: '1', gridColumn: '1' }}>
          <BalanceCard
            spentToday={balance.spentToday}
            earnedToday={balance.earnedToday}
            walletBalance={balance.usdcBalance}
            isRunning={status?.isRunning ?? false}
          />
        </div>

        {/* Zone B — Live Economy Feed */}
        <div style={{ gridRow: '1', gridColumn: '2' }}>
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="live-dot" />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  LIVE ECONOMY FEED
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="font-mono" style={{ fontSize: 12, color: net >= 0 ? 'var(--earn-mint)' : 'var(--warn-amber)' }}>
                  {net >= 0 ? '+' : '-'}${Math.abs(net).toFixed(4)} today
                </span>
                <button
                  className="btn-primary"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  onClick={triggerRun}
                  disabled={triggering || (status?.isRunning ?? false)}
                >
                  {triggering || status?.isRunning ? '⟳ Running…' : '▶ Run Now'}
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <LiveFeed entries={feedEntries} />
            </div>
          </div>
        </div>

        {/* Zone C — Agent Flow */}
        <div style={{ gridRow: '2', gridColumn: '1' }}>
          <FlowGraph events={allEvents} />
        </div>

        {/* Zone D — Brief Preview (free metadata — pay in Library to read full) */}
        <div style={{ gridRow: '2', gridColumn: '2' }}>
          <BriefPreview brief={latestBrief} />
        </div>
      </div>
    </div>
  )
}
