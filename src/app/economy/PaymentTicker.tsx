'use client'

import { useMemo } from 'react'
import type { EconomyEvent } from '../../shared/types'
import { useSafeReducedMotion } from '../components/landing/useSafeReducedMotion'

interface TickerItem {
  id: string
  text: string
  color: string
  icon: string
}

// Builds a ticker line from the same real events that already power the Live
// Feed and FlowGraph — no invented activity, just a denser, glanceable
// restatement of it.
function toTickerItem(event: EconomyEvent): TickerItem | null {
  const d = event.data as Record<string, unknown>
  switch (event.type) {
    case 'payment:sent': {
      const amt = (d.amountUsd as number) ?? 0
      if (amt <= 0) return null
      return { id: event.id, text: `-$${amt.toFixed(4)} ${(d.domain ?? d.url ?? 'source') as string}`, color: 'var(--usdc-blue)', icon: '●' }
    }
    case 'payment:received':
      return { id: event.id, text: `+$${((d.amountUsd as number) ?? 0).toFixed(4)} brief sale`, color: 'var(--earn-mint)', icon: '★' }
    case 'agent:deposit':
      return { id: event.id, text: `deposit $${((d.amountUsd as number) ?? 0).toFixed(2)}`, color: 'var(--usdc-blue)', icon: '◆' }
    case 'agent:withdrawal':
      return { id: event.id, text: `withdrew $${((d.amountUsd as number) ?? 0).toFixed(4)}`, color: 'var(--usdc-blue)', icon: '◆' }
    case 'discovery:bought':
      return { id: event.id, text: `bought $${((d.amountUsd as number) ?? 0).toFixed(4)} marketplace brief`, color: 'var(--ai-purple)', icon: '◆' }
    case 'brief:published':
      return { id: event.id, text: `published "${((d.title as string) ?? 'brief').slice(0, 34)}"`, color: 'var(--ai-purple)', icon: '◆' }
    case 'payment:skipped':
      return { id: event.id, text: `skip ${(d.domain ?? d.url ?? 'source') as string}`, color: 'var(--text-muted)', icon: '○' }
    default:
      return null
  }
}

export default function PaymentTicker({ events }: { events: EconomyEvent[] }) {
  const reducedMotion = useSafeReducedMotion()

  const items = useMemo(() => {
    const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp)
    const built: TickerItem[] = []
    for (const e of sorted) {
      const item = toTickerItem(e)
      if (item) built.push(item)
      if (built.length >= 20) break
    }
    return built
  }, [events])

  if (items.length === 0) return null

  if (reducedMotion) {
    return (
      <div className="ticker-static">
        {items.slice(0, 5).map(item => (
          <span key={item.id} className="ticker-item" style={{ color: item.color }}>
            {item.icon} {item.text}
          </span>
        ))}
      </div>
    )
  }

  // Duplicated once so the marquee loop has no visible seam at the wrap point.
  const loop = [...items, ...items]

  return (
    <div className="ticker">
      <div className="ticker-track">
        {loop.map((item, i) => (
          <span key={`${item.id}-${i}`} className="ticker-item" style={{ color: item.color }}>
            {item.icon} {item.text}
          </span>
        ))}
      </div>
    </div>
  )
}
