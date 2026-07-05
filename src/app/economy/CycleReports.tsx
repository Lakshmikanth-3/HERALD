'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface CycleReport {
  id: string
  topic: string
  stage: 'complete' | 'no-content' | 'synthesis-failed' | 'insufficient-balance' | 'error'
  sourcesCount: number
  sessionSpent: number
  briefId?: string
  briefTitle?: string
  briefPrice?: number
  error?: string
  cycleMs: number
  timestamp: number
}

const STAGE_LABEL: Record<CycleReport['stage'], { text: string; color: string }> = {
  'complete':             { text: 'Published',  color: 'var(--earn-mint)' },
  'no-content':           { text: 'No content',  color: 'var(--text-muted)' },
  'synthesis-failed':     { text: 'Synthesis failed', color: 'var(--danger-red)' },
  'insufficient-balance': { text: 'Low balance', color: 'var(--warn-amber)' },
  'error':                { text: 'Error',       color: 'var(--danger-red)' },
}

export default function CycleReports({ refreshKey }: { refreshKey: number }) {
  const [reports, setReports] = useState<CycleReport[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/agent/cycles?limit=20`)
      .then(r => r.ok ? r.json() : [])
      .then(setReports)
      .finally(() => setLoading(false))
  }, [refreshKey])

  if (loading) return null

  if (reports.length === 0) {
    return (
      <div className="card" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No cycle history yet — run a cycle to see per-cycle reports here.
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        CYCLE HISTORY ({reports.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {reports.map(r => {
          const stage = STAGE_LABEL[r.stage] ?? { text: r.stage, color: 'var(--text-muted)' }
          const isOpen = expanded === r.id
          return (
            <div key={r.id} style={{ borderRadius: 8, background: isOpen ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
              <button
                onClick={() => setExpanded(isOpen ? null : r.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: stage.color, flexShrink: 0, minWidth: 100 }}>{stage.text}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.briefTitle ?? `"${r.topic}"`}
                </span>
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {new Date(r.timestamp * 1000).toLocaleTimeString()}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{isOpen ? '▲' : '▾'}</span>
              </button>
              {isOpen && (
                <div style={{ padding: '4px 10px 10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: 12 }}>
                  <Field label="Topic" value={`"${r.topic}"`} />
                  <Field label="Sources" value={String(r.sourcesCount)} />
                  <Field label="Spent" value={`$${r.sessionSpent.toFixed(4)}`} />
                  <Field label="Duration" value={`${(r.cycleMs / 1000).toFixed(1)}s`} />
                  {r.briefPrice != null && <Field label="Brief price" value={`$${r.briefPrice.toFixed(3)}`} />}
                  {r.error && <Field label="Error" value={r.error} color="var(--danger-red)" />}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div className="font-mono" style={{ color: color ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
