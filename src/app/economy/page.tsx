'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import HeraldNav from '../components/HeraldNav'
import SSEListener from '../components/SSEListener'
import LiveFeed, { buildFeedEntry } from './LiveFeed'
import BalanceCard from './BalanceCard'
import FlowGraph from './FlowGraph'
import BriefPreview from './BriefPreview'
import { CycleStepper, FirstRunCard, CycleToast } from './CycleStatus'
import type { CycleStep, CycleSummary } from './CycleStatus'
import CycleReports from './CycleReports'
import type { EconomyEvent, BriefMetadata } from '../../shared/types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface AgentStatus {
  configured: boolean
  isRunning: boolean
  topic: string | null
  walletAddress: string | null
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
  const [flowHistory, setFlowHistory] = useState<EconomyEvent[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [latestBrief, setLatestBrief] = useState<BriefMetadata | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [cycleStep, setCycleStep] = useState<CycleStep | null>(null)
  const [cycleActive, setCycleActive] = useState(false)
  const [cycleSummary, setCycleSummary] = useState<CycleSummary | null>(null)
  const [cycleReportsKey, setCycleReportsKey] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Load initial status, balance, latest brief preview, and past feed history
  // (real DB-persisted payment/skip/publish events) so the page never looks
  // dead on a fresh load, before any live SSE event has fired.
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

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`${API}/api/agent/feed-history?limit=50`)
        if (res.ok) {
          const history = await res.json() as EconomyEvent[]
          setFlowHistory(history)
          const entries = history
            .map(buildFeedEntry)
            .filter((e): e is FeedEntry => e !== null)
            .map(e => ({ ...e, historical: true }))
          setFeedEntries(entries)
        }
      } catch (e) {
        console.error('Failed to load feed history:', e)
      } finally {
        setHistoryLoaded(true)
      }
    }
    loadHistory()
  }, [])

  const handleEvent = useCallback((event: EconomyEvent) => {
    setAllEvents(prev => [...prev, event].slice(-200))

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

    // ── Cycle progress: derive the active step + a completion summary from
    // real cycle events (never simulated — same events power the stepper,
    // the "Running…" spinner on the Run Now button, and this toast).
    if (event.type === 'agent:cycle:start') {
      const stage = event.data.stage as string
      setCycleActive(true)
      setCycleSummary(null)
      if (stage === 'starting' || stage === 'discovering') setCycleStep('discover')
      else if (stage === 'scoring') setCycleStep('score')
      else if (stage === 'synthesizing' || stage === 'synthesis') setCycleStep('synthesize')
    }
    if (event.type === 'payment:sent' || event.type === 'payment:skipped') {
      setCycleStep(prev => (prev === 'discover' || prev === 'score' || prev === null) ? 'pay' : prev)
    }
    if (event.type === 'brief:published') {
      setCycleStep('publish')
    }
    if (event.type === 'agent:cycle:end') {
      setCycleActive(false)
      setCycleStep(null)
      const d = event.data as Record<string, unknown>
      const summary: CycleSummary = {
        stage: d.stage as string,
        sourcesCount: d.sourcesCount as number | undefined,
        sessionSpent: d.sessionSpent as number | undefined,
        briefTitle: d.briefTitle as string | undefined,
        error: d.error as string | undefined,
      }
      setCycleSummary(summary)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setCycleSummary(null), 8000)
      // A cycle just ended (whatever the outcome) — a new row exists in
      // cycle_reports, so refetch the list.
      setCycleReportsKey(k => k + 1)
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
  const isRunning = cycleActive || (status?.isRunning ?? false)
  const showFirstRun = historyLoaded && feedEntries.length === 0 && !isRunning

  // Real-data sparkline: running net balance over time, built from the same
  // payment history that powers the Live Feed and FlowGraph — never a
  // fabricated trend line.
  const netHistory = useMemo(() => {
    const paymentEvents = [...flowHistory, ...allEvents]
      .filter(e => e.type === 'payment:sent' || e.type === 'payment:received')
      .sort((a, b) => a.timestamp - b.timestamp)
    if (paymentEvents.length === 0) return []
    let running = 0
    const series = paymentEvents.map(e => {
      const amt = (e.data.amountUsd as number) ?? 0
      running += e.type === 'payment:received' ? amt : -amt
      return running
    })
    return series.slice(-30)
  }, [flowHistory, allEvents])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SSEListener onEvent={handleEvent} />
      <HeraldNav topic={status?.topic ?? undefined} />

      <div style={{ padding: '20px 20px 0' }}>
        {showFirstRun && (
          <FirstRunCard onRun={triggerRun} running={triggering || isRunning} configured={status?.configured ?? false} />
        )}
        <div className="card" style={{ marginBottom: 16, padding: '10px 16px', overflowX: 'auto' }}>
          <CycleStepper activeStep={cycleStep} running={isRunning} />
        </div>
      </div>

      <div className="economy-grid" style={{ paddingTop: 0 }}>

        {/* Zone A — Balance */}
        <div style={{ gridRow: '1', gridColumn: '1', minHeight: 0 }}>
          <BalanceCard
            spentToday={balance.spentToday}
            earnedToday={balance.earnedToday}
            walletBalance={balance.usdcBalance}
            isRunning={isRunning}
            walletAddress={status?.walletAddress}
            netHistory={netHistory}
          />
        </div>

        {/* Zone B — Live Economy Feed */}
        <div style={{ gridRow: '1', gridColumn: '2', minHeight: 0 }}>
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
                  disabled={triggering || isRunning}
                >
                  {triggering || isRunning ? '⟳ Running…' : '▶ Run Now'}
                </button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <LiveFeed entries={feedEntries} />
            </div>
          </div>
        </div>

        {/* Zone C — Agent Flow */}
        <div style={{ gridRow: '2', gridColumn: '1', minHeight: 0 }}>
          <FlowGraph events={allEvents} history={flowHistory} />
        </div>

        {/* Zone D — Brief Preview (free metadata — pay in Library to read full) */}
        <div style={{ gridRow: '2', gridColumn: '2', minHeight: 0 }}>
          <BriefPreview brief={latestBrief} />
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <CycleReports refreshKey={cycleReportsKey} />
      </div>

      {cycleSummary && (
        <CycleToast summary={cycleSummary} onDismiss={() => setCycleSummary(null)} />
      )}
    </div>
  )
}
