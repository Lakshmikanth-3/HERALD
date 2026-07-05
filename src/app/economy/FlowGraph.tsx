'use client'

import { useEffect, useRef, useState } from 'react'
import type { EconomyEvent } from '../../shared/types'
import { dedupeNewById } from '../../lib/dedupe'

interface GraphNode {
  id: string
  type: 'agent' | 'source' | 'buyer' | 'marketplace'
  label: string
  totalUsd: number
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface GraphEdge {
  sourceId: string
  targetId: string
  active: boolean
  lastActive?: number
  direction: 'in' | 'out'
}

interface GraphState {
  nodes: Map<string, GraphNode>
  edges: Map<string, GraphEdge>
}

interface Props {
  events: EconomyEvent[]
  history?: EconomyEvent[]
}

const AGENT_NODE: GraphNode = { id: 'herald-agent', type: 'agent', label: 'HERALD', totalUsd: 0 }

function nodeRadius(node: GraphNode): number {
  return node.type === 'agent' ? 18 : Math.min(6 + node.totalUsd * 1000, 14)
}

function nodeColor(type: GraphNode['type']): string {
  switch (type) {
    case 'agent':       return '#2775CA'
    case 'source':      return '#2775CA'
    case 'buyer':       return '#4DFFD2'
    case 'marketplace': return '#A78BFA'
  }
}

// Applies one event's effect on the graph (node totals + edge activity).
// Returns the edge key to spawn a particle on, or null for events that don't
// affect the flow graph (e.g. agent:cycle:start).
function applyEventToState(state: GraphState, event: EconomyEvent, activate: boolean): string | null {
  const d = event.data as Record<string, unknown>

  if (event.type === 'payment:sent') {
    const domain = (d.domain ?? d.url ?? 'source') as string
    const id = `source:${domain}`
    const existing = state.nodes.get(id)
    state.nodes.set(id, {
      id, type: 'source', label: domain,
      totalUsd: (existing?.totalUsd ?? 0) + ((d.amountUsd as number) ?? 0),
    })
    const edgeKey = `${id}→herald-agent`
    state.edges.set(edgeKey, {
      sourceId: id, targetId: 'herald-agent', active: true,
      lastActive: activate ? Date.now() : undefined, direction: 'out',
    })
    return edgeKey
  }

  if (event.type === 'payment:received') {
    const buyerAddr = (d.buyerAddress ?? 'buyer') as string
    const shortAddr = buyerAddr.length > 8 ? buyerAddr.slice(0, 6) + '…' : buyerAddr
    const id = `buyer:${buyerAddr}`
    const existing = state.nodes.get(id)
    state.nodes.set(id, {
      id, type: 'buyer', label: shortAddr,
      totalUsd: (existing?.totalUsd ?? 0) + ((d.amountUsd as number) ?? 0),
    })
    const edgeKey = `herald-agent→${id}`
    state.edges.set(edgeKey, {
      sourceId: 'herald-agent', targetId: id, active: true,
      lastActive: activate ? Date.now() : undefined, direction: 'in',
    })
    return edgeKey
  }

  // Agent-to-agent marketplace purchase (src/agent/agentToAgent.ts) — a real
  // x402 buy from another agent's published brief, kept visually distinct
  // (purple) from ordinary source reads even though money flows the same
  // direction (agent pays out).
  if (event.type === 'discovery:bought') {
    const briefId = (d.briefId as string) ?? 'brief'
    const id = `marketplace:${briefId}`
    const existing = state.nodes.get(id)
    state.nodes.set(id, {
      id, type: 'marketplace', label: ((d.title as string) ?? 'marketplace brief').slice(0, 16),
      totalUsd: (existing?.totalUsd ?? 0) + ((d.amountUsd as number) ?? 0),
    })
    const edgeKey = `${id}→herald-agent`
    state.edges.set(edgeKey, {
      sourceId: id, targetId: 'herald-agent', active: true,
      lastActive: activate ? Date.now() : undefined, direction: 'out',
    })
    return edgeKey
  }

  return null
}

export default function FlowGraph({ events, history }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GraphState>({ nodes: new Map([['herald-agent', { ...AGENT_NODE }]]), edges: new Map() })
  const animRef = useRef<number>()
  const particlesRef = useRef<Array<{ edgeKey: string; t: number; dir: 'in' | 'out' }>>([])
  const ringPulsesRef = useRef<Array<{ nodeId: string; start: number }>>([])
  const processedIdsRef = useRef<Set<string>>(new Set())
  const dashOffsetRef = useRef(0)
  const [hasData, setHasData] = useState(false)
  const [hover, setHover] = useState<{ node: GraphNode; mouseX: number; mouseY: number } | null>(null)
  // The draw loop reads hover state via this ref, not the `hover` value
  // itself — mousemove fires far more often than a component re-render
  // should tear down and rebuild the whole canvas/rAF/ResizeObserver setup.
  const hoverRef = useRef<{ node: GraphNode } | null>(null)

  // Seed real aggregated totals from DB history — no particles, just the
  // static picture of who's been paid / who's paid so far. Depends on
  // `history` itself, not `[]`: the parent page fetches feed-history
  // asynchronously in its own effect, so `history` is always `[]` on this
  // component's first mount — an empty-deps "run once on mount" effect
  // would seed from that empty array and then never run again once the
  // real data arrived, permanently stuck showing the empty state despite
  // real history existing. dedupeNewById makes re-running this safe: ids
  // already applied are skipped, so this only ever processes what's new.
  useEffect(() => {
    if (!history || history.length === 0) return
    const state = stateRef.current
    let seeded = false
    for (const event of dedupeNewById(processedIdsRef.current, history)) {
      if (applyEventToState(state, event, false)) seeded = true
    }
    if (seeded) setHasData(true)
  }, [history])

  // Live events animate particles along the edges. Processed by id so that
  // events already seen (including ones carried over from `history`) are
  // never re-applied — re-running this over the whole accumulated array on
  // every new event would otherwise double-count totals and re-spawn
  // particles for every past event each time.
  useEffect(() => {
    const state = stateRef.current
    const newParticles: typeof particlesRef.current = []

    let gotData = false
    for (const event of dedupeNewById(processedIdsRef.current, events)) {
      const edgeKey = applyEventToState(state, event, true)
      if (edgeKey) {
        newParticles.push({ edgeKey, t: 0, dir: event.type === 'payment:received' ? 'in' : 'out' })
        gotData = true
      }
    }

    particlesRef.current = [...particlesRef.current, ...newParticles]
    if (gotData) setHasData(true)
  }, [events])

  // D3-style force simulation + canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function resize() {
      canvas!.width  = canvas!.offsetWidth
      canvas!.height = canvas!.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let pulse = 0

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      let found: GraphNode | null = null
      for (const node of stateRef.current.nodes.values()) {
        if (node.x == null || node.y == null) continue
        const r = nodeRadius(node) + 6
        const dx = mx - node.x, dy = my - node.y
        if (dx * dx + dy * dy <= r * r) { found = node; break }
      }
      hoverRef.current = found ? { node: found } : null
      setHover(found ? { node: found, mouseX: mx, mouseY: my } : null)
    }
    function onMouseLeave() { hoverRef.current = null; setHover(null) }
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)

    function draw() {
      const W = canvas!.width
      const H = canvas!.height
      const state = stateRef.current
      const nodes = [...state.nodes.values()]

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#070B14'
      ctx.fillRect(0, 0, W, H)

      // Layout: agent center, sources left, buyers right
      const cx = W / 2, cy = H / 2

      // Ambient radial glow behind the HERALD center node, independent of
      // its own node glow — a soft field the whole graph sits inside.
      const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.55)
      bgGlow.addColorStop(0, 'rgba(39,117,202,0.08)')
      bgGlow.addColorStop(1, 'rgba(39,117,202,0)')
      ctx.fillStyle = bgGlow
      ctx.fillRect(0, 0, W, H)

      nodes.forEach((node) => {
        if (node.type === 'agent') { node.x = cx; node.y = cy; return }
        const peers = nodes.filter(n => n.type === node.type)
        const idx   = peers.indexOf(node)
        const count = peers.length
        if (node.type === 'source') {
          node.x = cx - W * 0.32
          node.y = cy - ((count - 1) * 42) / 2 + idx * 42
        } else if (node.type === 'buyer') {
          node.x = cx + W * 0.32
          node.y = cy - ((count - 1) * 42) / 2 + idx * 42
        } else {
          // marketplace: below the agent so it never collides with the
          // source (left) / buyer (right) fans.
          node.x = cx - ((count - 1) * 60) / 2 + idx * 60
          node.y = cy + H * 0.32
        }
      })

      const nodeMap = new Map(nodes.map(n => [n.id, n]))

      if (!reduceMotion) dashOffsetRef.current += 0.35

      // Draw edges — curved (quadratic bezier) so source/buyer fans don't
      // overlap the agent node in a straight line pile-up; idle edges show
      // a slowly drifting dash so the graph never reads as frozen even with
      // no live activity.
      state.edges.forEach((edge) => {
        const src = nodeMap.get(edge.sourceId)
        const tgt = nodeMap.get(edge.targetId)
        if (!src || !tgt || src.x == null || tgt.x == null) return

        const age = edge.lastActive ? Date.now() - edge.lastActive : 999999
        const recentlyActive = age < 2000
        const opacity = recentlyActive ? 0.85 : 0.22

        const mx = (src.x + tgt.x) / 2
        const my = (src.y! + tgt.y!) / 2
        const dx = tgt.x - src.x, dy = tgt.y! - src.y!
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len, ny = dx / len
        const bend = edge.direction === 'out' ? 26 : -26
        const ctrlX = mx + nx * bend
        const ctrlY = my + ny * bend

        const isMarketplace = src.type === 'marketplace' || tgt.type === 'marketplace'
        const edgeRgb = isMarketplace ? '167,139,250' : edge.direction === 'out' ? '39,117,202' : '77,255,210'

        ctx.beginPath()
        ctx.moveTo(src.x, src.y!)
        ctx.quadraticCurveTo(ctrlX, ctrlY, tgt.x, tgt.y!)
        ctx.strokeStyle = `rgba(${edgeRgb},${opacity})`
        ctx.lineWidth = recentlyActive ? 1.5 : 1
        if (!recentlyActive) {
          ctx.setLineDash([4, 7])
          ctx.lineDashOffset = reduceMotion ? 0 : -dashOffsetRef.current
        } else {
          ctx.setLineDash([])
        }
        ctx.stroke()
        ctx.setLineDash([])
      })

      // Animate particles along their edge's curve. On reduced motion the
      // particle system is skipped entirely — the static graph (nodes,
      // edges, real totals) still renders, just without motion.
      const advanced = reduceMotion
        ? []
        : particlesRef.current.map(p => ({ ...p, t: p.t + 0.018 }))

      for (const p of advanced) {
        if (p.t >= 1) {
          const edge = state.edges.get(p.edgeKey)
          if (edge) ringPulsesRef.current.push({ nodeId: edge.targetId, start: Date.now() })
        }
      }
      particlesRef.current = advanced.filter(p => p.t <= 1)

      particlesRef.current.forEach(particle => {
        const edge = state.edges.get(particle.edgeKey)
        if (!edge) return
        const src = nodeMap.get(edge.sourceId)
        const tgt = nodeMap.get(edge.targetId)
        if (!src || !tgt || src.x == null || tgt.x == null) return

        const mx = (src.x + tgt.x) / 2, my = (src.y! + tgt.y!) / 2
        const dx = tgt.x - src.x, dy = tgt.y! - src.y!
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len, ny = dx / len
        const bend = edge.direction === 'out' ? 26 : -26
        const ctrlX = mx + nx * bend, ctrlY = my + ny * bend
        const isMarketplace = src.type === 'marketplace' || tgt.type === 'marketplace'
        const color = isMarketplace ? '#A78BFA' : particle.dir === 'out' ? '#2775CA' : '#4DFFD2'

        function pointAt(t: number) {
          const it = 1 - t
          const x = it * it * src!.x! + 2 * it * t * ctrlX + t * t * tgt!.x!
          const y = it * it * src!.y! + 2 * it * t * ctrlY + t * t * tgt!.y!
          return { x, y }
        }

        // Short fading trail behind the lead particle.
        for (let k = 4; k >= 0; k--) {
          const tt = Math.max(0, particle.t - k * 0.035)
          const { x, y } = pointAt(tt)
          ctx.beginPath()
          ctx.arc(x, y, Math.max(1, 3 - k * 0.5), 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.globalAlpha = (1 - k * 0.22) * (1 - particle.t * 0.4)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      })

      // Ring-pulse on arrival at the destination node.
      ringPulsesRef.current = ringPulsesRef.current.filter(rp => Date.now() - rp.start < 600)
      ringPulsesRef.current.forEach(rp => {
        const node = nodeMap.get(rp.nodeId)
        if (!node || node.x == null) return
        const age = (Date.now() - rp.start) / 600
        const r = nodeRadius(node) + age * 20
        ctx.beginPath()
        ctx.arc(node.x, node.y!, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,255,255,${(1 - age) * 0.55})`
        ctx.lineWidth = 2
        ctx.stroke()
      })

      // Draw nodes
      nodes.forEach(node => {
        if (node.x == null) return
        const radius = nodeRadius(node)
        const color = nodeColor(node.type)
        const label = node.type === 'agent' ? 'HERALD' : node.label
        const isHovered = hoverRef.current?.node.id === node.id
        const drawRadius = node.type === 'agent'
          ? (reduceMotion ? 18 : 18 + Math.sin(pulse) * 3)
          : isHovered ? radius + 2 : radius

        // Glow
        const glowMult = node.type === 'agent' ? 3.2 : 2.5
        const grd = ctx.createRadialGradient(node.x, node.y!, 0, node.x, node.y!, drawRadius * glowMult)
        grd.addColorStop(0, color + (isHovered ? '60' : '40'))
        grd.addColorStop(1, color + '00')
        ctx.beginPath()
        ctx.arc(node.x, node.y!, drawRadius * glowMult, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        // Circle
        ctx.beginPath()
        ctx.arc(node.x, node.y!, drawRadius, 0, Math.PI * 2)
        ctx.fillStyle = node.type === 'agent' ? color : '#0D1424'
        ctx.fill()
        ctx.strokeStyle = isHovered ? '#FFFFFF' : color
        ctx.lineWidth = node.type === 'agent' ? 2 : isHovered ? 2 : 1.5
        ctx.stroke()

        // Label
        ctx.fillStyle = node.type === 'agent' ? '#fff' : '#94A3B8'
        ctx.font = node.type === 'agent' ? 'bold 10px Inter' : '9px Inter'
        ctx.textAlign = 'center'
        ctx.fillText(label.slice(0, 12), node.x, node.y! + drawRadius + 14)
      })

      pulse += 0.04
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          AGENT FLOW
        </span>
        <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--usdc-blue)' }}>● Sources</span>
          <span style={{ color: 'var(--earn-mint)' }}>● Buyers</span>
          <span style={{ color: 'var(--ai-purple)' }}>● Marketplace</span>
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 8, background: '#070B14', cursor: hover ? 'pointer' : 'default' }}
        />
        {!hasData && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '1.5rem', pointerEvents: 'none',
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 220 }}>
              Your agent&apos;s economy will appear here after its first cycle.
            </p>
          </div>
        )}
        {hover && (
          <div style={{
            position: 'absolute',
            left: Math.min(hover.mouseX + 12, (canvasRef.current?.clientWidth ?? 300) - 150),
            top: Math.max(hover.mouseY - 40, 4),
            background: 'rgba(7,11,20,0.95)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {hover.node.type === 'agent' ? 'HERALD (you)' : hover.node.label}
            </div>
            {hover.node.type !== 'agent' && (
              <div className="font-mono" style={{
                color: hover.node.type === 'source' ? 'var(--usdc-blue)' : hover.node.type === 'buyer' ? 'var(--earn-mint)' : 'var(--ai-purple)',
              }}>
                ${hover.node.totalUsd.toFixed(4)} total
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
