'use client'

import type { BriefMetadata } from '../../shared/types'

interface Props {
  brief: BriefMetadata | null
}

export default function BriefPreview({ brief }: Props) {
  if (!brief) {
    return (
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: 32, opacity: 0.2 }}>◆</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
          No briefs yet.<br />
          <span style={{ fontSize: 12 }}>First brief will appear here after the agent&apos;s first synthesis cycle.</span>
        </p>
      </div>
    )
  }

  const isProfit = brief.revenue > brief.productionCost
  const net = brief.revenue - brief.productionCost
  const netStr = Math.abs(net).toFixed(4)

  function copyX402Link() {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/briefs/${brief!.id}`
    navigator.clipboard.writeText(url)
  }

  return (
    <div className="card animate-slide-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          LAST BRIEF
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className={`badge ${brief.confidence === 'HIGH' ? 'badge-mint' : brief.confidence === 'MEDIUM' ? 'badge-amber' : 'badge-red'}`}>
            {brief.confidence}
          </span>
          <span className="badge badge-purple">{brief.sourcesCount} sources</span>
        </div>
      </div>

      {/* Title */}
      <div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          Published {new Date(brief.publishedAt * 1000).toLocaleTimeString()}
        </p>
        <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
          {brief.title}
        </h3>
      </div>

      {/* Key finding (free teaser — full text is paid content, see Library) */}
      <p style={{ fontSize: 13, color: 'var(--text-data)', lineHeight: 1.6, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
        {brief.keyFindingTeaser}
      </p>

      {/* Economics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <MicroStat label="Cost" value={`$${brief.productionCost.toFixed(4)}`} color="var(--usdc-blue)" />
        <MicroStat label="Revenue" value={`$${brief.revenue.toFixed(4)}`} color="var(--earn-mint)" />
        <MicroStat
          label="Net"
          value={`${net >= 0 ? '+' : '-'}$${netStr}`}
          color={isProfit ? 'var(--earn-mint)' : 'var(--warn-amber)'}
          tag={isProfit ? 'PROFITABLE' : 'INVESTING'}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <a
          href={`/library`}
          className="btn-primary"
          style={{ flex: 1, fontSize: 13, padding: '10px', textDecoration: 'none', textAlign: 'center' }}
        >
          Read Brief
        </a>
        <button
          className="btn-ghost btn-primary"
          style={{ flex: 1, fontSize: 13, padding: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--earn-mint)' }}
          onClick={copyX402Link}
        >
          Copy x402 Link
        </button>
      </div>
    </div>
  )
}

function MicroStat({ label, value, color, tag }: { label: string; value: string; color: string; tag?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div className="font-mono" style={{ fontSize: 12, fontWeight: 700, color }}>{value}</div>
      {tag && <div style={{ fontSize: 9, color, marginTop: 2, fontWeight: 600 }}>{tag} ✓</div>}
    </div>
  )
}
