'use client'

export interface CycleReport {
  id: string
  topic: string
  stage: 'complete' | 'no-content' | 'synthesis-failed' | 'insufficient-balance' | 'error'
  sourcesCount: number
  sessionSpent: number
  briefTitle?: string
  briefPrice?: number
  cycleMs: number
  timestamp: number
}

const STAGE_COLOR: Record<CycleReport['stage'], string> = {
  'complete':             'var(--earn-mint)',
  'no-content':           'var(--text-muted)',
  'synthesis-failed':     'var(--danger-red)',
  'insufficient-balance': 'var(--warn-amber)',
  'error':                'var(--danger-red)',
}

const MAX_BAR = 34

// A real time series, not a chart library — each bar is one real cycle
// report from the DB (sessionSpent + the brief's listed price, if one
// published), oldest to newest left to right.
export default function CycleTimeline({ cycles }: { cycles: CycleReport[] }) {
  if (cycles.length === 0) return null

  const ordered = [...cycles].sort((a, b) => a.timestamp - b.timestamp)
  const nets = ordered.map(r => (r.briefPrice ?? 0) - r.sessionSpent)
  const maxAbs = Math.max(...nets.map(Math.abs), 0.01)

  return (
    <div className="card animate-stagger-in" style={{ animationDelay: '420ms', marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        Cycle Timeline
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        Last {ordered.length} real cycles — bar height is (brief price − session spend), mint above the line, red below.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: MAX_BAR * 2 + 20, overflowX: 'auto', paddingBottom: 4 }}>
        {ordered.map((r, i) => {
          const net = nets[i]
          const barH = Math.max(2, Math.round((Math.abs(net) / maxAbs) * MAX_BAR))
          const color = r.stage === 'complete' ? (net >= 0 ? 'var(--earn-mint)' : 'var(--warn-amber)') : STAGE_COLOR[r.stage]
          return (
            <div key={r.id} className="timeline-bar-wrap" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 10, flexShrink: 0, height: '100%', justifyContent: 'center' }}>
              <div style={{ height: MAX_BAR, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: 6, height: net >= 0 ? barH : 2, background: color, borderRadius: '2px 2px 0 0', opacity: net >= 0 ? 1 : 0.35 }} />
              </div>
              <div style={{ width: 12, height: 1, background: 'var(--border)' }} />
              <div style={{ height: MAX_BAR, display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ width: 6, height: net < 0 ? barH : 2, background: net < 0 ? 'var(--danger-red)' : color, borderRadius: '0 0 2px 2px', opacity: net < 0 ? 1 : 0.35 }} />
              </div>
              <div className="timeline-tooltip">
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {r.briefTitle ? r.briefTitle.slice(0, 40) : `"${r.topic.slice(0, 30)}"`}
                </div>
                <div style={{ color: STAGE_COLOR[r.stage] }}>{r.stage}</div>
                <div>{r.sourcesCount} sources · spent ${r.sessionSpent.toFixed(4)}</div>
                {r.briefPrice != null && <div>listed ${r.briefPrice.toFixed(3)}</div>}
                <div style={{ color: 'var(--text-muted)' }}>{new Date(r.timestamp * 1000).toLocaleString()}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
