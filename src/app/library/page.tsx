'use client'

import { useState, useEffect, useRef } from 'react'
import HeraldNav from '../components/HeraldNav'
import type { Brief } from '../../shared/types'
import { txUrl, shortTx, isRealTxHash } from '../../lib/explorer'
import { useCountUp } from '../../lib/useCountUp'

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

interface Receipt {
  id: string
  amountUsd: number
  buyerAddress?: string
  timestamp: number
  txHash?: string
}

interface SourcePayment {
  url: string
  amountUsd: number
  timestamp: number
  txHash?: string
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
  const [justPaid, setJustPaid] = useState<{ id: string; txHash?: string } | null>(null)
  const [expandedReceipts, setExpandedReceipts] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<Record<string, Receipt[]>>({})
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [sourcePayments, setSourcePayments] = useState<Record<string, SourcePayment>>({})
  const [justProfitable, setJustProfitable] = useState<Set<string>>(new Set())
  const prevProfitRef = useRef<Record<string, boolean>>({})
  const totalRevenue = useCountUp(briefs.reduce((s, b) => s + b.revenue, 0))

  useEffect(() => {
    async function load() {
      try {
        const [briefsRes, marketRes, statusRes] = await Promise.all([
          fetch(`${API}/api/briefs`),
          fetch(`${API}/api/marketplace`),
          fetch(`${API}/api/agent/status`),
        ])
        if (briefsRes.ok) {
          const fresh: BriefMeta[] = await briefsRes.json()
          // A brief flipping from not-yet-profitable to profitable (real
          // revenue crossing real production cost) gets a one-time glow —
          // detected by diffing against the previous poll, never simulated.
          const flipped = new Set<string>()
          for (const b of fresh) {
            const isProfit = b.revenue - b.productionCost > 0
            if (prevProfitRef.current[b.id] === false && isProfit) flipped.add(b.id)
            prevProfitRef.current[b.id] = isProfit
          }
          setBriefs(fresh)
          if (flipped.size > 0) {
            setJustProfitable(flipped)
            setTimeout(() => setJustProfitable(new Set()), 1200)
          }
        }
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

  // Fetch real per-source payment proof once a brief is opened (unlocked).
  useEffect(() => {
    if (!openBrief) return
    fetch(`${API}/api/briefs/${openBrief.id}/source-payments`)
      .then(r => r.ok ? r.json() : [])
      .then((payments: SourcePayment[]) => {
        setSourcePayments(Object.fromEntries(payments.map(p => [p.url, p])))
      })
      .catch(() => {})
  }, [openBrief])

  // Buy a brief with the "demo buyer wallet" — a separate, real Arc testnet
  // wallet (src/agent/demoBuyer.ts), not the agent's own. Every brief in this
  // single-instance deployment is the agent's own, and Circle's Gateway
  // facilitator correctly rejects a wallet paying itself as `self_transfer`,
  // so this is what makes "Read"/"Buy" actually complete a real purchase.
  async function readBrief(id: string) {
    setPurchase({ id, status: 'paying' })
    setJustPaid(null)
    try {
      const res = await fetch(`${API}/api/agent/demo-buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPurchase({ id, status: 'error', error: data.error ?? `HTTP ${res.status}` })
        return
      }
      setOpenBrief(data.brief)
      setJustPaid({ id, txHash: data.txHash })
      setPurchase(null)
    } catch (err) {
      setPurchase({ id, status: 'error', error: (err as Error).message })
    }
  }

  function copyX402Link(id: string) {
    navigator.clipboard.writeText(`${API}/api/briefs/${id}`)
    setCopiedLink(id)
    setTimeout(() => setCopiedLink(null), 1500)
  }

  async function toggleReceipts(id: string) {
    if (expandedReceipts === id) {
      setExpandedReceipts(null)
      return
    }
    setExpandedReceipts(id)
    if (!receipts[id]) {
      try {
        const res = await fetch(`${API}/api/briefs/${id}/receipts`)
        if (res.ok) {
          const data = await res.json()
          setReceipts(prev => ({ ...prev, [id]: data }))
        }
      } catch {
        // Leave unset — the expander will just show nothing to fetch again next toggle
      }
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
                ${totalRevenue.toFixed(4)}
              </span>
            </span>
          </div>

          {loading && <LoadingRows />}

          {!loading && briefs.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>◆</div>
              No briefs yet. Go to{' '}
              <a href="/economy" style={{ color: 'var(--usdc-blue)' }}>Economy</a>{' '}
              and click &quot;Run Now&quot; to generate your first brief.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {briefs.map((b, i) => {
              const pl = profitLabel(b)
              const isPurchasing = purchase?.id === b.id
              const isExpanded = expandedReceipts === b.id
              const briefReceipts = receipts[b.id]
              const flipped = justProfitable.has(b.id)
              return (
                <div
                  key={b.id}
                  className={`card card-hover animate-stagger-in ${flipped ? 'glow-pulse-mint-once' : ''}`}
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={`/library/${b.id}`} style={{ textDecoration: 'none' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{b.title}</h3>
                      </a>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span className={`badge ${b.confidence === 'HIGH' ? 'badge-mint' : b.confidence === 'MEDIUM' ? 'badge-amber' : 'badge-red'}`}>
                          {b.confidence}
                        </span>
                        <span className="badge badge-purple">{b.sourcesCount} sources</span>
                        <span className="badge badge-blue">${b.priceUsd.toFixed(3)}</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{b.keyFindingTeaser}</p>
                      {isPurchasing && purchase?.status === 'error' && (
                        <p style={{ fontSize: 12, color: 'var(--danger-red, #ef4444)', marginTop: 6 }}>
                          ✗ {purchase.error}
                        </p>
                      )}
                      {justPaid?.id === b.id && (
                        <p style={{ fontSize: 12, color: 'var(--earn-mint)', marginTop: 6 }}>
                          ✓ Paid via real x402 (demo buyer wallet){justPaid.txHash && (
                            isRealTxHash(justPaid.txHash) ? (
                              <> — <a href={txUrl(justPaid.txHash)} target="_blank" rel="noopener noreferrer" className="font-mono" style={{ color: 'var(--earn-mint)' }}>
                                tx {shortTx(justPaid.txHash)} ↗
                              </a></>
                            ) : (
                              <> — <span className="font-mono">settlement {shortTx(justPaid.txHash)}</span></>
                            )
                          )}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                        <button
                          onClick={() => copyX402Link(b.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                        >
                          {copiedLink === b.id ? 'Copied ✓' : 'Copy x402 link'}
                        </button>
                        <button
                          onClick={() => toggleReceipts(b.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                        >
                          {isExpanded ? 'Hide receipts ▲' : `Payment receipts (${b.purchases}) ▾`}
                        </button>
                        <a href={`/library/${b.id}`} style={{ color: 'var(--usdc-blue)', fontSize: 12, textDecoration: 'none' }}>
                          Full page →
                        </a>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {briefReceipts === undefined && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading receipts…</span>
                          )}
                          {briefReceipts?.length === 0 && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No purchases yet.</span>
                          )}
                          {briefReceipts?.map(r => (
                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                              <span className="font-mono" style={{ color: 'var(--earn-mint)' }}>+${r.amountUsd.toFixed(4)}</span>
                              <span style={{ color: 'var(--text-muted)' }}>{new Date(r.timestamp * 1000).toLocaleString()}</span>
                              {r.txHash && isRealTxHash(r.txHash) ? (
                                <a href={txUrl(r.txHash)} target="_blank" rel="noopener noreferrer" className="font-mono" style={{ color: 'var(--usdc-blue)', textDecoration: 'none' }}>
                                  tx {shortTx(r.txHash)} ↗
                                </a>
                              ) : r.txHash ? (
                                <span className="font-mono" style={{ color: 'var(--text-muted)' }}>settlement {shortTx(r.txHash)}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div className={flipped ? 'animate-pop-in' : undefined} style={{ fontSize: 11, color: pl.color, fontWeight: 700, marginBottom: 4 }}>{pl.text} {net(b) > 0 ? '✓' : ''}</div>
                        <div className="font-mono" style={{ fontSize: 12, color: 'var(--earn-mint)' }}>${b.revenue.toFixed(4)}</div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>cost ${b.productionCost.toFixed(4)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{b.purchases} purchase{b.purchases !== 1 ? 's' : ''}</div>
                      </div>
                      <button
                        className="btn-primary btn-sheen"
                        style={{ fontSize: 12, padding: '7px 14px' }}
                        onClick={() => readBrief(b.id)}
                        disabled={isPurchasing}
                        title="Pays via a separate demo buyer wallet — Circle rejects the agent paying itself"
                      >
                        {isPurchasing
                          ? purchase?.status === 'paying' ? '⟳ Paying x402…' : '⟳ Loading…'
                          : `Read ($${b.priceUsd.toFixed(3)})`}
                      </button>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔑 demo buyer wallet</span>
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
            {marketplace.map((b, i) => {
              const isPurchasing = purchase?.id === b.id
              return (
                <div key={b.id} className="card card-hover animate-stagger-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, animationDelay: `${Math.min(i, 8) * 50}ms` }}>
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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <button
                      className="btn-primary btn-sheen"
                      style={{ fontSize: 13, padding: '10px 18px', whiteSpace: 'nowrap' }}
                      onClick={() => readBrief(b.id)}
                      disabled={isPurchasing}
                      title="Pays via a separate demo buyer wallet — Circle rejects the agent paying itself"
                    >
                      {isPurchasing
                        ? purchase?.status === 'paying' ? '⟳ x402 pay…' : '⟳'
                        : `Buy $${b.priceUsd.toFixed(3)}`}
                    </button>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔑 demo buyer wallet</span>
                  </div>
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
                {openBrief.sources.map((s, i) => {
                  const payment = sourcePayments[s.url]
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--usdc-blue)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          {s.title || s.url}
                        </a>
                        <span className="font-mono" style={{ color: s.cost > 0 ? 'var(--usdc-blue)' : 'var(--text-muted)', flexShrink: 0 }}>
                          {s.cost > 0 ? `$${s.cost.toFixed(4)}` : 'free'}
                        </span>
                      </div>
                      {payment?.txHash && (
                        <div style={{ paddingLeft: 2 }}>
                          {isRealTxHash(payment.txHash) ? (
                            <a href={txUrl(payment.txHash)} target="_blank" rel="noopener noreferrer" className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>
                              tx {shortTx(payment.txHash)} ↗
                            </a>
                          ) : (
                            <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              settlement {shortTx(payment.txHash)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
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
