'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function HeraldNav({ topic }: { topic?: string }) {
  const pathname = usePathname()

  return (
    <nav className="nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/" className="nav-logo">HERALD</Link>
        {topic && (
          <span className="nav-topic" style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            borderLeft: '1px solid var(--border)',
            paddingLeft: 16,
            maxWidth: 260,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            "{topic}"
          </span>
        )}
      </div>

      <div className="nav-links">
        <Link href="/deploy"    className={`nav-link ${pathname.startsWith('/deploy')    ? 'active' : ''}`}>Deploy</Link>
        <Link href="/economy"   className={`nav-link ${pathname.startsWith('/economy')   ? 'active' : ''}`}>Economy</Link>
        <Link href="/library"   className={`nav-link ${pathname.startsWith('/library')   ? 'active' : ''}`}>Library</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="live-dot" />
        <span className="nav-live-label" style={{ fontSize: 12, color: 'var(--earn-mint)', fontWeight: 600 }}>LIVE</span>
      </div>
    </nav>
  )
}
