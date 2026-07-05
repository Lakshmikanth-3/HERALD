'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function DeployPage() {
  return (
    <Suspense fallback={null}>
      <DeployForm />
    </Suspense>
  )
}

function DeployForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [topic, setTopic] = useState('')

  // Prefill from the landing page's Hero input (/deploy?topic=...)
  useEffect(() => {
    const fromQuery = searchParams.get('topic')
    if (fromQuery) setTopic(fromQuery)
  }, [searchParams])
  const [weeklyBudget, setWeeklyBudget] = useState(3)
  const [briefPrice, setBriefPrice] = useState(0.05)
  const [deploying, setDeploying] = useState(false)
  const [deployStage, setDeployStage] = useState('')
  const [error, setError] = useState('')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  // Real wallet balance, so an underfunded budget is preventable up front
  // instead of a confusing on-chain revert after clicking Deploy — the
  // weekly budget slider's max ($10) has no relationship to what's actually
  // in the wallet, and the deposit step is a real transfer that fails if
  // you ask for more than the wallet holds.
  useEffect(() => {
    fetch(`${API}/api/agent/balance`)
      .then(r => r.ok ? r.json() : null)
      .then(b => { if (b) setWalletBalance(b.usdcBalance) })
      .catch(() => {})
  }, [])

  const sessionsPerDay = 6
  const sourcesPerSession = Math.floor(weeklyBudget / (7 * sessionsPerDay * 0.003))
  const briefsPerWeek = 7 * sessionsPerDay / 3 // ~1 brief per 3 sessions
  const estimatedEarningsMin = (briefsPerWeek * briefPrice * 0.3).toFixed(2)
  const estimatedEarningsMax = (briefsPerWeek * briefPrice * 2).toFixed(2)

  async function handleDeploy() {
    if (!topic.trim() || topic.trim().length < 3) {
      setError('Please enter a research topic (at least 3 characters)')
      return
    }
    if (walletBalance !== null && weeklyBudget > walletBalance) {
      setError(`Your agent wallet only holds $${walletBalance.toFixed(4)} USDC — lower the weekly budget to $${walletBalance.toFixed(2)} or less, or fund the wallet first (see the README's TestMint step).`)
      return
    }
    setDeploying(true)
    setError('')
    try {
      setDeployStage('Saving agent configuration...')
      const res = await fetch(`${API}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), weeklyBudget, briefPrice }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? `Server error ${res.status}`)
      }

      // Deposit the weekly budget into Circle Gateway — real on-chain approve +
      // deposit — so the agent's wallet can actually spend via Gateway-batched
      // x402 payments (buying sources, buying other agents' briefs).
      setDeployStage(`Depositing $${weeklyBudget.toFixed(2)} USDC into Circle Gateway...`)
      const depositRes = await fetch(`${API}/api/agent/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd: weeklyBudget }),
      })
      if (!depositRes.ok) {
        const data = await depositRes.json()
        throw new Error(data.error ?? `Gateway deposit failed (${depositRes.status})`)
      }

      setDeployStage('Starting first research cycle...')
      await fetch(`${API}/api/agent/run`, { method: 'POST' })
      router.push('/economy')
    } catch (err) {
      setError((err as Error).message)
      setDeploying(false)
      setDeployStage('')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav className="nav">
        <a href="/" className="nav-logo">HERALD</a>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lepton Agents Hackathon</span>
      </nav>

      {/* Hero */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <div style={{ maxWidth: 580, width: '100%' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              <span className="badge badge-blue">x402</span>
              <span className="badge badge-mint">Circle Gateway</span>
              <span className="badge badge-purple">Arc Testnet</span>
            </div>
            <h1 className="font-display" style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 12 }}>
              Deploy your research agent
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6 }}>
              Your agent pays for every source it reads using x402 nanopayments on Arc,<br />
              then sells synthesized briefs to other agents and earns back.
            </p>
          </div>

          {/* Form card */}
          <div className="card" style={{ padding: '2rem' }}>
            {/* Topic */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-data)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                What should your agent research?
              </label>
              <input
                className="input"
                type="text"
                placeholder='e.g. "AI regulation in the EU"'
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDeploy()}
              />
            </div>

            {/* Weekly budget slider */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-data)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Weekly research budget
                </label>
                <span className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--usdc-blue)' }}>
                  ${weeklyBudget.toFixed(2)}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>/week</span>
                </span>
              </div>
              <input
                type="range"
                min={1} max={10} step={0.5}
                value={weeklyBudget}
                onChange={e => setWeeklyBudget(parseFloat(e.target.value))}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>$1.00</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>$10.00</span>
              </div>
              {walletBalance !== null && (
                <p style={{ fontSize: 12, color: weeklyBudget > walletBalance ? 'var(--warn-amber)' : 'var(--text-muted)', marginTop: 8 }}>
                  Wallet holds <span className="font-mono">${walletBalance.toFixed(4)}</span> USDC right now
                  {weeklyBudget > walletBalance && ' — that\'s less than this budget, deposit would fail'}
                </p>
              )}
            </div>

            {/* Brief price floor slider */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-data)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Minimum price per brief
                </label>
                <span className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--earn-mint)' }}>
                  ${briefPrice.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.01} max={0.20} step={0.01}
                value={briefPrice}
                onChange={e => setBriefPrice(parseFloat(e.target.value))}
                style={{ '--thumb-color': 'var(--earn-mint)' } as React.CSSProperties}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>$0.01</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>$0.20</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                Never sells below this floor. The actual price is{' '}
                <span style={{ color: 'var(--text-data)' }}>max(floor, 2× production cost)</span>
                {' '}— a well-sourced brief that costs more to produce can still sell above your floor.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', color: 'var(--danger-red)', fontSize: 14 }}>
                {error}
              </div>
            )}

            {/* Deploy button */}
            <button
              className="btn-primary"
              style={{ width: '100%', fontSize: 16, padding: '14px' }}
              onClick={handleDeploy}
              disabled={deploying}
            >
              {deploying ? (
                <>
                  <span className="animate-pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', display: 'inline-block' }} />
                  {deployStage || 'Deploying agent...'}
                </>
              ) : (
                '→ Deploy HERALD Agent'
              )}
            </button>
          </div>

          {/* Stats */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Agent will read{' '}
              <span style={{ color: 'var(--text-data)' }}>~{sourcesPerSession * 14} sources/week</span>
              {' '}·{' '}
              publish{' '}
              <span style={{ color: 'var(--text-data)' }}>~{Math.floor(briefsPerWeek)} briefs/week</span>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Estimated earnings:{' '}
              <span style={{ color: 'var(--earn-mint)' }}>
                ${estimatedEarningsMin}–${estimatedEarningsMax}/week
              </span>
              {' '}from other agents buying your briefs
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
