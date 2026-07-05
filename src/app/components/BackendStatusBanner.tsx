'use client'

import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const CHECK_INTERVAL_MS = 15000

export default function BackendStatusBanner() {
  const [reachable, setReachable] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`${API}/api/agent/status`, { signal: AbortSignal.timeout(5000) })
        if (!cancelled) setReachable(res.ok)
      } catch {
        if (!cancelled) setReachable(false)
      }
    }

    check()
    const iv = setInterval(check, CHECK_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  if (reachable) return null

  return (
    <div
      role="alert"
      style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'rgba(239,68,68,0.15)', borderBottom: '1px solid rgba(239,68,68,0.35)',
        color: '#FCA5A5', fontSize: 13, textAlign: 'center', padding: '8px 16px',
      }}
    >
      ⚠ Backend not reachable at {API} — the Express API, agent scheduler, and database all
      run locally and aren&apos;t hosted by this deployment. Run <code className="font-mono">npm run dev</code> on
      your machine to see live data.
    </div>
  )
}
