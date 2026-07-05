'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import HeraldNav from '../../components/HeraldNav'
import type { Brief, BriefMetadata } from '../../../shared/types'
import { txUrl, shortTx, isRealTxHash } from '../../../lib/explorer'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

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

// A proper reading view for one brief — real Gemini body (once paid for),
// the free preview metadata otherwise, and the full payment-receipt
// manifest (who bought this brief, what the agent paid per cited source)
// so the reader can see the real on-chain proof behind every citation
// without needing to leave the page.
export default function BriefDetailPage() {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [meta, setMeta] = useState<BriefMetadata | null>(null)
  const [full, setFull] = useState<Brief | null>(null)
  const [receipts, setReceipts] = useState<Receipt[] | null>(null)
  const [sourcePayments, setSourcePayments] = useState<Record<string, SourcePayment>>({})
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')
  const [justPaidTx, setJustPaidTx] = useState<string | undefined>(undefined)
  const [notFound, setNotFound] = useState(false)

  // Polls like every other data page in the app (Library list, Economy,
  // Network) — a one-shot fetch on mount would leave purchases/revenue/
  // receipts stale the moment anyone (another tab, a live cron cycle,
  // another agent) buys this brief while the page stays open.
  useEffect(() => {
    if (!id) return
    async function load() {
      const [previewRes, receiptsRes] = await Promise.all([
        fetch(`${API}/api/briefs/${id}/preview`),
        fetch(`${API}/api/briefs/${id}/receipts`),
      ])
      if (!previewRes.ok) { setNotFound(true); return }
      setMeta(await previewRes.json())
      if (receiptsRes.ok) setReceipts(await receiptsRes.json())
    }
    load()
    const iv = setInterval(load, 15000)
    return () => clearInterval(iv)
  }, [id])

  // Real per-source payment proof only makes sense once the sources
  // themselves are known — that requires the paid brief content.
  useEffect(() => {
    if (!full) return
    fetch(`${API}/api/briefs/${full.id}/source-payments`)
      .then(r => r.ok ? r.json() : [])
      .then((payments: SourcePayment[]) => setSourcePayments(Object.fromEntries(payments.map(p => [p.url, p]))))
      .catch(() => {})
  }, [full])

  async function readViaDemo() {
    if (!id) return
    setBuying(true)
    setBuyError('')
    try {
      const res = await fetch(`${API}/api/agent/demo-buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId: id }),
      })
      const data = await res.json()
      if (!res.ok) { setBuyError(data.error ?? `HTTP ${res.status}`); return }
      setFull(data.brief)
      setJustPaidTx(data.txHash)
    } catch (err) {
      setBuyError((err as Error).message)
    } finally {
      setBuying(false)
    }
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <HeraldNav />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>No brief found with this id.</p>
            <a href="/library" style={{ color: 'var(--usdc-blue)', fontSize: 13 }}>← Back to Library</a>
          </div>
        </div>
      </div>
    )
  }

  if (!meta) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <HeraldNav />
        <div className="card animate-fade-in" style={{ margin: '2rem auto', maxWidth: 700, width: '100%', height: 200, opacity: 0.4 }} />
      </div>
    )
  }

  const badgeClass = meta.confidence === 'HIGH' ? 'badge-mint' : meta.confidence === 'MEDIUM' ? 'badge-amber' : 'badge-red'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HeraldNav />

      <div style={{ flex: 1, maxWidth: 720, margin: '0 auto', width: '100%', padding: '32px 20px 60px' }}>
        <a href="/library" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Back to Library</a>

        <div className="animate-stagger-in" style={{ marginTop: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <span className={`badge ${badgeClass}`}>{meta.confidence}</span>
            <span className="badge badge-purple">{meta.sourcesCount} sources</span>
            <span className="badge badge-blue">${meta.priceUsd.toFixed(3)}</span>
          </div>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25, marginBottom: 8 }}>{meta.title}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Topic &ldquo;{meta.topic}&rdquo; · Published {new Date(meta.publishedAt * 1000).toLocaleString()}
          </p>
        </div>

        {/* Content: teaser + unlock CTA, or the real paid body */}
        {!full ? (
          <div className="card animate-stagger-in" style={{ animationDelay: '60ms', marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: 'var(--text-data)', lineHeight: 1.7, marginBottom: 16 }}>{meta.keyFindingTeaser}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              The full Gemini-synthesized brief is behind HERALD&apos;s own real x402 paywall.
              Reading it here pays via a separate, real demo buyer wallet (Circle correctly
              rejects HERALD paying itself).
            </p>
            {buyError && <p style={{ fontSize: 12, color: 'var(--danger-red, #ef4444)', marginBottom: 10 }}>✗ {buyError}</p>}
            <button className="btn-primary btn-sheen" onClick={readViaDemo} disabled={buying} style={{ fontSize: 14, padding: '10px 20px' }}>
              {buying ? '⟳ Paying x402…' : `Unlock full brief ($${meta.priceUsd.toFixed(3)})`}
            </button>
          </div>
        ) : (
          <div className="animate-stagger-in" style={{ animationDelay: '60ms', marginBottom: 24 }}>
            {justPaidTx && (
              <p style={{ fontSize: 12, color: 'var(--earn-mint)', marginBottom: 14 }}>
                ✓ Paid via real x402 (demo buyer wallet){' '}
                {isRealTxHash(justPaidTx) ? (
                  <a href={txUrl(justPaidTx)} target="_blank" rel="noopener noreferrer" className="font-mono" style={{ color: 'var(--earn-mint)' }}>
                    — tx {shortTx(justPaidTx)} ↗
                  </a>
                ) : (
                  <span className="font-mono">— settlement {shortTx(justPaidTx)}</span>
                )}
              </p>
            )}

            <section style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Key Finding</h4>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>{full.keyFinding}</p>
            </section>

            {full.supportingPoints.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Supporting Evidence</h4>
                <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {full.supportingPoints.map((pt, i) => (
                    <li key={i} style={{ fontSize: 14, color: 'var(--text-data)', lineHeight: 1.6, paddingLeft: 16, borderLeft: '2px solid var(--usdc-blue)' }}>{pt}</li>
                  ))}
                </ul>
              </section>
            )}

            {full.gaps.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Gaps / Uncertainties</h4>
                <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {full.gaps.map((g, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--warn-amber)', paddingLeft: 16, borderLeft: '2px solid var(--warn-amber)' }}>{g}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Sources ({full.sources.length})
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Every citation below is backed by a real on-chain payment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {full.sources.map((s, i) => {
                  const payment = sourcePayments[s.url]
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, paddingBottom: 8, borderBottom: i < full.sources.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--usdc-blue)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                          {s.title || s.url}
                        </a>
                        <span className="font-mono" style={{ color: s.cost > 0 ? 'var(--usdc-blue)' : 'var(--text-muted)', flexShrink: 0 }}>
                          {s.cost > 0 ? `$${s.cost.toFixed(4)}` : 'free'}
                        </span>
                      </div>
                      {payment?.txHash && (
                        isRealTxHash(payment.txHash) ? (
                          <a href={txUrl(payment.txHash)} target="_blank" rel="noopener noreferrer" className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>
                            tx {shortTx(payment.txHash)} ↗
                          </a>
                        ) : (
                          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>settlement {shortTx(payment.txHash)}</span>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {/* Payment receipt manifest — public, real payment metadata, shown
            regardless of whether the paid content above has been unlocked. */}
        <section className="card animate-stagger-in" style={{ animationDelay: '120ms' }}>
          <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Payment Receipts ({meta.purchases})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {receipts === null && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>}
            {receipts?.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No purchases yet.</span>}
            {receipts?.map(r => (
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
          <div style={{ display: 'flex', gap: 16, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Production cost: <span style={{ color: 'var(--usdc-blue)' }}>${meta.productionCost.toFixed(4)}</span>
            </span>
            <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Revenue: <span style={{ color: 'var(--earn-mint)' }}>${meta.revenue.toFixed(4)}</span>
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
