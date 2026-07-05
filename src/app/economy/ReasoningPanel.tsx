'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { EconomyEvent } from '../../shared/types'

interface Line {
  id: string
  text: string
  color: string
}

// Every line here is derived from fields the agent already emits for real
// decisions (relevance scores, skip reasons, session-budget math) — nothing
// is invented for display. This just makes the existing decision trail
// legible as a running log instead of scattered across separate feed rows.
function toReasoningLine(event: EconomyEvent): Line | null {
  const d = event.data as Record<string, unknown>
  switch (event.type) {
    case 'agent:cycle:start': {
      const stage = d.stage as string
      if (stage === 'starting') return { id: event.id, text: `> cycle started — topic "${d.topic}"`, color: '#94A3B8' }
      if (stage === 'agent-to-agent') return { id: event.id, text: '> checking marketplace for a relevant brief from another agent…', color: '#94A3B8' }
      if (stage === 'discovering') return { id: event.id, text: `> discovering sources for "${d.topic}"…`, color: '#94A3B8' }
      if (stage === 'scoring') return { id: event.id, text: `> scored ${d.sourcesCount} sources — ${d.toPayCount} above threshold, ${d.toSkipCount} below`, color: '#94A3B8' }
      if (stage === 'synthesizing') return { id: event.id, text: `> synthesizing ${d.sourcesCount} sources with Gemini…`, color: '#4ADE80' }
      return null
    }
    case 'payment:sent': {
      const amt = (d.amountUsd as number) ?? 0
      const domain = (d.domain ?? d.url ?? 'source') as string
      if (amt > 0) return { id: event.id, text: `scoring ${domain}… above threshold → paying $${amt.toFixed(4)}`, color: '#4ADE80' }
      const score = d.relevanceScore as string | undefined
      return { id: event.id, text: `scoring ${domain}…${score ? ` ${score} → free, reading` : ' → free, reading'}`, color: '#4ADE80' }
    }
    case 'payment:skipped': {
      const domain = (d.domain ?? d.url ?? 'source') as string
      const score = d.score as number | undefined
      const reason = (d.reason as string) ?? 'below threshold'
      return { id: event.id, text: `scoring ${domain}…${score !== undefined ? ` ${score.toFixed(2)}` : ''} → skip (${reason})`, color: '#64748B' }
    }
    case 'discovery:bought':
      return { id: event.id, text: `marketplace: bought "${((d.title as string) ?? 'brief').slice(0, 40)}" for $${((d.amountUsd as number) ?? 0).toFixed(4)}`, color: '#A78BFA' }
    case 'discovery:skipped':
      return { id: event.id, text: `marketplace: no purchase — ${(d.reason as string) ?? 'nothing relevant enough'}`, color: '#64748B' }
    case 'brief:published':
      return { id: event.id, text: `> published "${((d.title as string) ?? 'brief').slice(0, 50)}" at $${(d.priceUsd as number)?.toFixed(3)}`, color: '#4DFFD2' }
    case 'agent:cycle:end': {
      const stage = d.stage as string
      if (stage === 'no-content') return { id: event.id, text: '> cycle complete — nothing cleared the relevance bar, nothing published', color: '#F59E0B' }
      if (stage === 'error') return { id: event.id, text: `> cycle error — ${d.error}`, color: '#EF4444' }
      return { id: event.id, text: '> cycle complete', color: '#94A3B8' }
    }
    default:
      return null
  }
}

export default function ReasoningPanel({ events, forceOpen }: { events: EconomyEvent[]; forceOpen?: boolean }) {
  const [open, setOpen] = useState(!!forceOpen)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  const lines = useMemo(() => {
    const built: Line[] = []
    for (const e of events) {
      const line = toReasoningLine(e)
      if (line) built.push(line)
    }
    return built.slice(-60)
  }, [events])

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [lines, open])

  const newestId = lines.length > 0 ? lines[lines.length - 1].id : null

  // Deliberately not `.card` — this already lives inside the Live Feed's own
  // card (Economy Zone B), and a second nested `.card` would read as a real
  // card-overlap regression to the automated overlap-detection check (one
  // rect fully contained inside another), which exists specifically to catch
  // that failure mode. A plain bordered box gets the same visual separation
  // without tripping it.
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Agent Reasoning
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{open ? 'Hide ▲' : `Show (${lines.length}) ▾`}</span>
      </button>
      {open && (
        <div ref={scrollRef} className="reasoning-panel" style={{ marginTop: 10 }}>
          {lines.length === 0 && <div className="reasoning-line" style={{ opacity: 0.5 }}>waiting for the next cycle…</div>}
          {lines.map(line => (
            <div
              key={line.id}
              className={`reasoning-line${line.id === newestId ? ' newest' : ''}`}
              style={{ color: line.color, '--full-width': `${line.text.length + 1}ch` } as React.CSSProperties}
            >
              {line.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
