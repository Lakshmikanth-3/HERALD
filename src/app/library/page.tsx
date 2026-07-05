'use client'

import { useState, useEffect } from 'react'
import HeraldNav from '../components/HeraldNav'
import type { Brief } from '../../shared/types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface BriefMeta {
  id: string
  title: string
  topic: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  sourcesCount: number
  productionCost: number
  priceUsd: number
  publishedAt: number
  revenue: number
  purchases: number
  keyFindingTeaser: string
}

interface PurchaseState {
  id: string
  status: 'pending' | 'paying' | 'error'
  error?: string
}

export default function LibraryPage() {
  const [briefs, setBriefs] = useState<BriefMeta[]>([])
  const [marketplace, setMarketplace] = useState<BriefMeta[]>([])
  const [openBrief, setOpenBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchase, setPurchase] = useState<PurchaseState | null>(null)
  const [topic, setTopic] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [briefsRes, marketRes, statusRes] = await Promise.all([
          fetch(`${API}/api/briefs`),
          fetch(`${API}/api/marketplace`),
          fetch(`${API}/api/agent/status`),
        ])
        if (briefsRes.ok)  setBriefs(await briefsRes.json())
        if (marketRes.ok)  setMarketplace(await marketRes.json())
        if (statusRes.ok) {
          const s = await statusRes.json()
          setTopic(s.topic)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
    const iv = setInterval(load, 15000)
    return () => clearInterval(iv)
  }, [])

  // Read own brief — sends a real x402 purchase request using the agent wallet.
  // The server verifies the payment against Circle Gateway before returning content.
  async function readBrief(id: string, priceUsd: number) {
    setPurchase({ id, status: 'pending' })
    try {
      // Step 1: Hit the endpoint to get the 402 challenge
      const challengeRes = await fetch(`${API}/api/briefs/${id}`)

      if (challengeRes.status === 402) {
        // Step 2: Got a real x402 challenge — instruct the agent to pay
        setPurchase({ id, status: 'paying' })
        const challenge = await challengeRes.json()

        // Step 3: Request the agent wallet to make the payment via the agent run endpoint
        // The agent's /api/agent/pay endpoint triggers a Circle wallet transfer to the payTo address
        const payRes = await fetch(`${API}/api/agent/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            briefId: id,
            priceUsd,
            challenge: challenge.x402 ?? challenge,
          }),
        })

        if (!payRes.ok) {
          const err = await payRes.json()
          setPurchase({ id, status: 'error', error: err.error ?? 'Payment failed' })
          return
        }

        const payData = await payRes.json()
        // Step 4: Use the signed X-PAYMENT header returned by the payment endpoint
        const contentRes = await fetch(`${API}/api/briefs/${id}`, {
          headers: { 'X-PAYMENT': payData.xPaymentHeader },
        })

        if (contentRes.ok) {
          setOpenBrief(await contentRes.json())
          setPurchase(null)
        } else {
          const err = await contentRes.json()
          setPurchase({ id, status: 'error', error: err.error ?? 'Content delivery failed after payment' })
        }
      } else if (challengeRes.ok) {
        // Shouldn't happen for gated content, but handle gracefully
        setOpenBrief(await challengeRes.json())
        setPurchase(null)
      } else {
        const err = await challengeRes.json()
        setPurchase({ id, status: 'error', error: err.error ?? `HTTP ${challengeRes.status}` })
      }
    } catch (err) {
      setPurchase({ id, status: 'error', error: (err as Error).message })
    }
  }

  const net = (b: BriefMeta) => b.revenue - b.productionCost
  const profitLabel = (b: BriefMeta) =>
    net(b) > 0 ? { text: 'PROFITABLE', color: 'var(--earn-mint)' }
    : Math.abs(net(b)) < 0.005 ? { text: 'BREAK-EVEN', color: 'var(--warn-amber)' }
    : { text: 'INVESTING', color: 'var(--text-muted)' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <HeraldNav topic={topic ?? undefined} />

      <div style={{ flex: 1, maxWidth: 900, margin: '0 auto', width: '100%', padding: '28px 20px' }}>

        {/* ── YOUR BRIEFS ───────────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700 }}>
              Your Briefs
              <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>({briefs.length})</span>
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Total revenue: <span className="font-mono" style={{ color: 'var(--earn-mint)' }}>
                ${briefs.reduce((s, b) => s + b.revenue, 0).toFixed(4)}
              </span>
            </span>
          </div>

          {loading && <LoadingRows />}

          {!loading && briefs.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>◆</div>
              No briefs yet. Go to{' '}
              <a href="/economy" style={{ color: 'var(--usdc-blue)' }}>Economy</a>{' '}
              and click "Run Now" to generate your first brief.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {briefs.map(b => {
              const pl = profitLabel(b)
              const isPurchasing = purchase?.id === b.id
              return (
                <div key={b.id} className="card card-hover" style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <span className={`badge ${b.confidence === 'HIGH' ? 'badge-mint' : b.confidence === 'MEDIUM' ? 'badge-amber' : 'badge-red'}`}>
                          {b.confidence}
                        </span>
                        <span className="badge badge-purple">{b.sourcesCount} sources</span>
                        <span className="badge badge-blue">${b.priceUsd.toFixed(3)}</span>
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{b.title}</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{b.keyFindingTeaser}</p>
                      {isPurchasing && purchase?.status === 'error' && (
                        <p style={{ fontSize: 12, color: 'var(--danger-red, #ef4444)', marginTop: 6 }}>
                          ✗ {purchase.error}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: pl.color, fontWeight: 700, marginBottom: 4 }}>{pl.text} {net(b) > 0 ? '✓' : ''}</div>
                        <div className="font-mono" style={{ fontSize: 12, color: 'var(--earn-mint)' }}>${b.revenue.toFixed(4)}</div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>cost ${b.productionCost.toFixed(4)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{b.purchases} purchase{b.purchases !== 1 ? 's' : ''}</div>
                      </div>
                      <button
                        className="btn-primary"
                        style={{ fontSize: 12, padding: '7px 14px' }}
                        onClick={() => readBrief(b.id, b.priceUsd)}
                        disabled={isPurchasing}
                      >
                        {isPurchasing
                          ? purchase?.status === 'paying' ? '⟳ Paying x402…' : '⟳ Loading…'
                          : `Read ($${b.priceUsd.toFixed(3)})`}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── MARKETPLACE ─────────────────────────────────────────── */}
        <section>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
            HERALD Marketplace
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>buy briefs from other agents via x402</span>
          </h2>

          {marketplace.length === 0 && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 14 }}>
              No marketplace briefs yet — this fills up as more HERALD agents publish.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {marketplace.map(b => {
              const isPurchasing = purchase?.id === b.id
              return (
                <div key={b.id} className="card card-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <span className="badge badge-blue">${b.priceUsd.toFixed(3)} USDC</span>
                      <span className="badge badge-purple">{b.sourcesCount} sources</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, alignSelf: 'center' }}>
                        {b.purchases} purchases this week
                      </span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{b.title}</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>{b.keyFindingTeaser}</p>
                    {isPurchasing && purchase?.status === 'error' && (
                      <p style={{ fontSize: 12, color: 'var(--danger-red, #ef4444)', marginTop: 6 }}>✗ {purchase.error}</p>
                    )}
                  </div>
                  <button
                    className="btn-primary"
                    style={{ fontSize: 13, padding: '10px 18px', whiteSpace: 'nowrap', flexShrink: 0 }}
                    onClick={() => readBrief(b.id, b.priceUsd)}
                    disabled={isPurchasing}
                  >
                    {isPurchasing
                      ? purchase?.status === 'paying' ? '⟳ x402 pay…' : '⟳'
                      : `Buy $${b.priceUsd.toFixed(3)}`}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* ── Full Brief Modal ──────────────────────────────────────── */}
      {openBrief && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(7,11,20,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={e => e.target === e.currentTarget && setOpenBrief(null)}
        >
          <div className="card animate-fade-in" style={{ maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <span className={`badge ${openBrief.confidence === 'HIGH' ? 'badge-mint' : 'badge-amber'}`}>{openBrief.confidence}</span>
                  <span className="badge badge-purple">{openBrief.sources.length} sources</span>
                </div>
                <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700 }}>{openBrief.title}</h2>
              </div>
              <button onClick={() => setOpenBrief(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Key Finding</h4>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>{openBrief.keyFinding}</p>
            </div>

            {openBrief.supportingPoints.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Supporting Evidence</h4>
                <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openBrief.supportingPoints.map((pt, i) => (
                    <li key={i} style={{ fontSize: 14, color: 'var(--text-data)', lineHeight: 1.6, paddingLeft: 16, borderLeft: '2px solid var(--usdc-blue)' }}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {openBrief.gaps.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Gaps / Uncertainties</h4>
                <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {openBrief.gaps.map((g, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--warn-amber)', paddingLeft: 16, borderLeft: '2px solid var(--warn-amber)' }}>{g}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Sources ({openBrief.sources.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {openBrief.sources.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--usdc-blue)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                      {s.title || s.url}
                    </a>
                    <span className="font-mono" style={{ color: s.cost > 0 ? 'var(--usdc-blue)' : 'var(--text-muted)', flexShrink: 0 }}>
                      {s.cost > 0 ? `$${s.cost.toFixed(4)}` : 'free'}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
                <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Production cost: <span style={{ color: 'var(--usdc-blue)' }}>${openBrief.productionCost.toFixed(4)}</span>
                </span>
                <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Revenue: <span style={{ color: 'var(--earn-mint)' }}>${openBrief.revenue.toFixed(4)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LoadingRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ height: 80, opacity: 0.4, animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )
}
