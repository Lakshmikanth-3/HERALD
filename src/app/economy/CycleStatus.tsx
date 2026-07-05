'use client'

export type CycleStep = 'discover' | 'score' | 'pay' | 'synthesize' | 'publish'

const STEPS: Array<{ key: CycleStep; label: string }> = [
  { key: 'discover',   label: 'Discover' },
  { key: 'score',      label: 'Score' },
  { key: 'pay',        label: 'Pay' },
  { key: 'synthesize', label: 'Synthesize' },
  { key: 'publish',    label: 'Publish' },
]

export interface CycleSummary {
  stage: string
  sourcesCount?: number
  sessionSpent?: number
  briefTitle?: string
  error?: string
}

export function cycleSummaryMessage(s: CycleSummary): string {
  if (s.stage === 'error') return `Cycle failed: ${s.error ?? 'unknown error'}`
  if (s.stage === 'no-content') return 'Cycle complete: no sources cleared the relevance bar — nothing bought, nothing published.'
  const parts: string[] = []
  if (s.sourcesCount !== undefined) parts.push(`${s.sourcesCount} source${s.sourcesCount === 1 ? '' : 's'} bought`)
  if (s.sessionSpent !== undefined) parts.push(`$${s.sessionSpent.toFixed(4)} spent`)
  parts.push(s.briefTitle ? '1 brief published' : 'no brief published')
  return `Cycle complete: ${parts.join(' · ')}`
}

// ── Stepper ──────────────────────────────────────────────────────────────────
export function CycleStepper({ activeStep, running }: { activeStep: CycleStep | null; running: boolean }) {
  const activeIdx = activeStep ? STEPS.findIndex(s => s.key === activeStep) : -1

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {STEPS.map((step, i) => {
        const done = running && activeIdx > i
        const active = running && activeIdx === i
        const color = active ? 'var(--earn-mint)' : done ? 'var(--usdc-blue)' : 'var(--text-muted)'
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className={active ? 'live-dot' : undefined}
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: done ? 'var(--usdc-blue)' : active ? 'var(--earn-mint)' : 'rgba(255,255,255,0.15)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color, whiteSpace: 'nowrap' }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span style={{ width: 14, height: 1, background: done ? 'var(--usdc-blue)' : 'rgba(255,255,255,0.12)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── First-run guided card ────────────────────────────────────────────────────
export function FirstRunCard({ onRun, running, configured }: { onRun: () => void; running: boolean; configured: boolean }) {
  return (
    <div className="card animate-fade-in" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <div>
        <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          {configured ? "Your agent hasn't run yet" : 'No agent deployed yet'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 480 }}>
          {configured
            ? 'Every cycle it discovers sources, scores them, pays for the ones worth reading via real x402 nanopayments, synthesizes a brief with Gemini, then publishes it behind its own paywall.'
            : 'Set a topic and budget on the Deploy screen first, then come back here to watch it work.'}
        </p>
      </div>
      {configured ? (
        <button className="btn-primary" style={{ fontSize: 13, padding: '10px 18px', flexShrink: 0 }} onClick={onRun} disabled={running}>
          {running ? '⟳ Running…' : '▶ Run a cycle now'}
        </button>
      ) : (
        <a href="/deploy" className="btn-primary" style={{ fontSize: 13, padding: '10px 18px', flexShrink: 0, textDecoration: 'none' }}>
          → Go to Deploy
        </a>
      )}
    </div>
  )
}

// ── Completion toast ─────────────────────────────────────────────────────────
export function CycleToast({ summary, onDismiss }: { summary: CycleSummary; onDismiss: () => void }) {
  const isError = summary.stage === 'error'
  return (
    <div
      className="card animate-slide-in"
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 200, maxWidth: 340,
        display: 'flex', alignItems: 'flex-start', gap: 10,
        borderColor: isError ? 'rgba(239,68,68,0.35)' : 'var(--border-glow-mint)',
      }}
    >
      <span style={{ fontSize: 16, color: isError ? 'var(--danger-red)' : 'var(--earn-mint)', flexShrink: 0 }}>
        {isError ? '✗' : '✓'}
      </span>
      <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
        {cycleSummaryMessage(summary)}
      </p>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  )
}
