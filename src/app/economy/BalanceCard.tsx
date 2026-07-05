'use client'

interface Props {
  spentToday: number
  earnedToday: number
  walletBalance: number
  isRunning: boolean
}

export default function BalanceCard({ spentToday, earnedToday, walletBalance, isRunning }: Props) {
  const net = earnedToday - spentToday
  const netColor = net >= 0
    ? 'var(--earn-mint)'
    : Math.abs(net) < spentToday * 0.5
      ? 'var(--warn-amber)'
      : '#EF4444'

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
      </div>

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
            {net >= 0 ? '+' : ''}${net.toFixed(4)}
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
