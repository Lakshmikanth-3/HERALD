'use client'

import { useState } from 'react'
import { addressUrl, shortAddr } from '../../lib/explorer'

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
  const netColor = net >= 0
    ? 'var(--earn-mint)'
    : Math.abs(net) < spentToday * 0.5
      ? 'var(--warn-amber)'
      : '#EF4444'
  const [copied, setCopied] = useState(false)

  function copyWallet() {
    if (!walletAddress) return
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
          ${walletBalance.toFixed(4)}
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
      </div>

      {netHistory && netHistory.length > 1 && <Sparkline values={netHistory} />}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Daily stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <StatRow label="Spent today" value={spentToday} color="var(--usdc-blue)" prefix="-" />
        <StatRow label="Earned today" value={earnedToday} color="var(--earn-mint)" prefix="+" />

        {/* Net */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Net today</span>
          <span className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: netColor }}>
            {net >= 0 ? '+' : '-'}${Math.abs(net).toFixed(4)}
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
// FlowGraph — never a fabricated trend line.
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

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Net over time</div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={points} fill="none" stroke={trendColor} strokeWidth={1.5} />
      </svg>
    </div>
  )
}
