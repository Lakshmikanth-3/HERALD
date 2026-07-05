'use client'

import { useState, useEffect } from 'react'
import HeraldNav from '../components/HeraldNav'
import { ARC_EXPLORER, addressUrl, shortAddr } from '../../lib/explorer'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const LOOP_STEPS = [
  { key: 'discover',   label: 'Discover',   detail: 'Pulls candidate sources from RSS/news feeds for your topic.' },
  { key: 'score',      label: 'Score',      detail: 'A transparent, rule-based formula rates relevance, freshness, domain trust, and length.' },
  { key: 'pay',        label: 'Pay',        detail: 'Sources scoring above the threshold get a real x402 nanopayment, signed by the agent’s Circle wallet.' },
  { key: 'synthesize', label: 'Synthesize', detail: 'Gemini reads everything it bought and writes a short, cited research brief.' },
  { key: 'publish',    label: 'Publish',    detail: 'The brief goes behind the agent’s own x402 paywall so other agents can pay to read it.' },
]

interface AgentStatus {
  walletAddress: string | null
  topic: string | null
}

interface ChainInfo {
  network: string
  chainId: number
  explorerBase: string
  usdcContractAddress: string | null
  gatewayWalletContractAddress: string
  agentWalletAddress: string | null
  sourcesWalletAddress: string | null
}

export default function HowItWorksPage() {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null)
  const [briefId, setBriefId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API}/api/agent/status`).then(r => r.ok ? r.json() : null).then(s => { if (s) setStatus(s) })
    fetch(`${API}/api/agent/chain-info`).then(r => r.ok ? r.json() : null).then(c => { if (c) setChainInfo(c) })
    fetch(`${API}/api/briefs?limit=1`).then(r => r.ok ? r.json() : []).then(briefs => {
      if (briefs.length > 0) setBriefId(briefs[0].id)
    })
  }, [])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const curlPath = briefId ? `/api/briefs/${briefId}` : '/api/briefs/:id'
  const curlSnippet = `curl -i ${API}${curlPath}`

  const proofRows: Array<{ label: string; value: string | null; kind: 'address' | 'text' }> = [
    { label: 'Agent wallet',            value: chainInfo?.agentWalletAddress ?? null,   kind: 'address' },
    { label: 'Sources treasury wallet', value: chainInfo?.sourcesWalletAddress ?? null, kind: 'address' },
    { label: 'USDC contract',           value: chainInfo?.usdcContractAddress ?? null,  kind: 'address' },
    { label: 'Gateway wallet contract', value: chainInfo?.gatewayWalletContractAddress ?? null, kind: 'address' },
    { label: 'Network',                 value: chainInfo ? `${chainInfo.network} (chain id ${chainInfo.chainId})` : null, kind: 'text' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HeraldNav topic={status?.topic ?? undefined} />

      <div style={{ flex: 1, maxWidth: 800, margin: '0 auto', width: '100%', padding: '40px 20px 60px' }}>
        <h1 className="font-display" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>
          How HERALD works
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 40 }}>
          One agent wallet, two roles: a buyer that pays for what it reads, and a
          seller that charges for what it writes. Every step below runs against
          real infrastructure — nothing here is simulated.
        </p>

        {/* ── The loop ─────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 44 }}>
          <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>The loop</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {LOOP_STEPS.map((step, i) => (
              <div key={step.key} className="animate-stagger-in" style={{ display: 'flex', gap: 16, animationDelay: `${i * 80}ms` }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-card)', border: '1px solid var(--border-glow-mint, rgba(77,255,210,0.35))',
                    color: 'var(--earn-mint)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  }}>
                    {i + 1}
                  </div>
                  {i < LOOP_STEPS.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', minHeight: 28 }} />}
                </div>
                <div style={{ paddingBottom: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{step.label}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── What is x402 ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 44 }}>
          <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>What is x402?</h2>
          <div className="card">
            <p style={{ fontSize: 14, color: 'var(--text-data)', lineHeight: 1.7 }}>
              x402 revives the long-unused HTTP 402 &ldquo;Payment Required&rdquo; status code
              as a real payment protocol: a server asks for money instead of a
              login. When HERALD requests a paywalled brief or article without
              paying, it gets back a 402 response listing exactly what to pay,
              in which token, and to which address. HERALD&apos;s Circle wallet signs
              a real EIP-3009 authorization for that amount, resends the request
              with the signature attached in an <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--earn-mint)' }}>X-PAYMENT</code> header,
              and Circle&apos;s Gateway facilitator verifies and settles it on Arc
              testnet before the content is released — all inside a single
              back-and-forth, with no separate checkout flow.
            </p>
          </div>
        </section>

        {/* ── Verify it's real ─────────────────────────────────────────────── */}
        <section style={{ marginBottom: 44 }}>
          <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Verify it&apos;s real</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Every address below is a real Arc testnet wallet or contract — click through to {ARC_EXPLORER.replace('https://', '')}.
          </p>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>
            {proofRows.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                  padding: '14px 18px', borderBottom: i < proofRows.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                {row.value ? (
                  row.kind === 'address' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{shortAddr(row.value)}</span>
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, cursor: 'pointer' }} onClick={() => copy(row.value!, row.label)}>
                        {copied === row.label ? 'Copied ✓' : 'Copy'}
                      </button>
                      <a href={addressUrl(row.value)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--usdc-blue)', textDecoration: 'none' }}>
                        View ↗
                      </a>
                    </div>
                  ) : (
                    <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{row.value}</span>
                  )
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>not configured</span>
                )}
              </div>
            ))}
          </div>

          {!chainInfo?.agentWalletAddress && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10 }}>
              No wallet configured yet — <a href="/deploy" style={{ color: 'var(--usdc-blue)' }}>deploy an agent</a> to provision one.
            </p>
          )}

          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Reproduce a real 402 response
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
              {briefId
                ? 'This hits one of HERALD’s own published briefs — you’ll get back a real Circle Gateway payment challenge, not a mock.'
                : 'No briefs published yet — this is the general shape of the request. Run a cycle from the Economy screen, then reload this page for a live brief id.'}
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px',
            }}>
              <code className="font-mono" style={{ flex: 1, fontSize: 12, color: 'var(--earn-mint)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                {curlSnippet}
              </code>
              <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }} onClick={() => copy(curlSnippet, 'curl')}>
                {copied === 'curl' ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Expect <span className="font-mono">HTTP/1.1 402 Payment Required</span> with a JSON body listing the Circle Gateway payment requirements.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
