'use client'

import { useState, useRef, useEffect } from 'react'
import { addressUrl, txUrl, shortAddr, shortTx } from '../../lib/explorer'
import { formatSigned } from '../../lib/format'
import { useCountUp } from '../../lib/useCountUp'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  spentToday: number
  earnedToday: number
  walletBalance: number
  isRunning: boolean
  walletAddress?: string | null
  netHistory?: number[]
}

export default function BalanceCard({ spentToday, earnedToday, walletBalance, isRunning, walletAddress, netHistory }: Props) {
  const net = earnedToday - spentToday
  const animatedBalance = useCountUp(walletBalance)
  const animatedSpent = useCountUp(spentToday)
  const animatedEarned = useCountUp(earnedToday)
  const animatedNet = useCountUp(net)
  const netColor = net >= 0
    ? 'var(--earn-mint)'
    : Math.abs(net) < spentToday * 0.5
      ? 'var(--warn-amber)'
      : '#EF4444'
  const [copied, setCopied] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [destination, setDestination] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'idle' | 'pending' | 'error' | 'done'>('idle')
  const [error, setError] = useState('')
  const [resultTxHash, setResultTxHash] = useState<string | undefined>(undefined)

  function copyWallet() {
    if (!walletAddress) return
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function submitWithdraw() {
    const amountNum = parseFloat(amount)
    if (!destination || !/^0x[a-fA-F0-9]{40}$/.test(destination)) {
      setStatus('error'); setError('Enter a valid EVM address (0x...)')
      return
    }
    if (!amountNum || amountNum <= 0 || amountNum > walletBalance) {
      setStatus('error'); setError(`Enter an amount between 0 and $${walletBalance.toFixed(4)}`)
      return
    }
    setStatus('pending')
    setError('')
    try {
      const res = await fetch(`${API}/api/agent/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd: amountNum, destinationAddress: destination }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error'); setError(data.error ?? `HTTP ${res.status}`)
        return
      }
      setResultTxHash(data.txHash)
      setStatus('done')
    } catch (err) {
      setStatus('error'); setError((err as Error).message)
    }
  }

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          BALANCE
        </span>
        {isRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            <span style={{ fontSize: 11, color: 'var(--earn-mint)' }}>Running</span>
          </div>
        )}
      </div>

      {/* Wallet balance */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Wallet</div>
        <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          ${animatedBalance.toFixed(4)}
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>USDC</span>
        </div>
        {walletAddress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{shortAddr(walletAddress)}</span>
            <button
              onClick={copyWallet}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: 0 }}
              title="Copy wallet address"
            >
              {copied ? '✓' : '⧉'}
            </button>
            <a
              href={addressUrl(walletAddress)}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'var(--usdc-blue)', textDecoration: 'none' }}
            >
              Arc explorer ↗
            </a>
          </div>
        )}
        {walletAddress && (
          <button
            onClick={() => setWithdrawOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: 0, marginTop: 6 }}
          >
            {withdrawOpen ? 'Cancel withdraw ▲' : 'Withdraw ▾'}
          </button>
        )}
        {withdrawOpen && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              className="input"
              placeholder="Destination address (0x...)"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px' }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input"
                placeholder={`Amount (max $${walletBalance.toFixed(4)})`}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ fontSize: 12, padding: '6px 10px', flex: 1 }}
              />
              <button
                className="btn-primary"
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={submitWithdraw}
                disabled={status === 'pending'}
              >
                {status === 'pending' ? '⟳' : 'Send'}
              </button>
            </div>
            {status === 'error' && (
              <p style={{ fontSize: 11, color: 'var(--danger-red, #ef4444)' }}>✗ {error}</p>
            )}
            {status === 'done' && (
              <p style={{ fontSize: 11, color: 'var(--earn-mint)' }}>
                ✓ Withdrawn{resultTxHash && (
                  <> — <a href={txUrl(resultTxHash)} target="_blank" rel="noopener noreferrer" className="font-mono" style={{ color: 'var(--earn-mint)' }}>
                    tx {shortTx(resultTxHash)} ↗
                  </a></>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {netHistory && netHistory.length > 1 && <Sparkline values={netHistory} />}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Daily stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <StatRow label="Spent today" value={animatedSpent} color="var(--usdc-blue)" prefix="-" />
        <StatRow label="Earned today" value={animatedEarned} color="var(--earn-mint)" prefix="+" />

        {/* Net */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Net today</span>
          <span className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: netColor }}>
            {formatSigned(animatedNet)}
          </span>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, color, prefix }: {
  label: string
  value: number
  color: string
  prefix: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span className="font-mono" style={{ fontSize: 14, fontWeight: 600, color }}>
        {prefix}${value.toFixed(4)}
      </span>
    </div>
  )
}

// A real-data sparkline of running net balance (earned − spent) over time,
// built from the same payment history that powers the Live Feed and
// FlowGraph — never a fabricated trend line. Draws itself in on mount/data
// change rather than just appearing, using the real length of the actual
// line (not a guessed constant) so the reveal always finishes cleanly.
function Sparkline({ values }: { values: number[] }) {
  const width = 180
  const height = 36
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = width / (values.length - 1)
  const points = values.map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`).join(' ')
  const last = values[values.length - 1]
  const trendColor = last >= 0 ? 'var(--earn-mint)' : 'var(--warn-amber)'

  const lineRef = useRef<SVGPolylineElement>(null)
  const [dashLength, setDashLength] = useState<number | null>(null)

  useEffect(() => {
    if (lineRef.current) setDashLength(lineRef.current.getTotalLength())
  }, [points])

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Net over time</div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline
          ref={lineRef}
          points={points}
          fill="none"
          stroke={trendColor}
          strokeWidth={1.5}
          className={dashLength ? 'animate-draw-line' : undefined}
          style={dashLength ? { '--line-length': dashLength } as React.CSSProperties : undefined}
        />
      </svg>
    </div>
  )
}
