'use client'

import { useEffect, useRef } from 'react'
import type { EconomyEvent } from '../../shared/types'

interface GraphNode {
  id: string
  type: 'agent' | 'source' | 'buyer'
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
}

const AGENT_NODE: GraphNode = { id: 'herald-agent', type: 'agent', label: 'HERALD', totalUsd: 0 }

export default function FlowGraph({ events }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GraphState>({ nodes: new Map([['herald-agent', { ...AGENT_NODE }]]), edges: new Map() })
  const animRef = useRef<number>()
  const particlesRef = useRef<Array<{ edgeKey: string; t: number; dir: 'in' | 'out' }>>([])

  // Update graph state from events
  useEffect(() => {
    const state = stateRef.current
    const newParticles: typeof particlesRef.current = []

    events.forEach(event => {
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
        state.edges.set(edgeKey, { sourceId: id, targetId: 'herald-agent', active: true, lastActive: Date.now(), direction: 'out' })
        newParticles.push({ edgeKey, t: 0, dir: 'out' })
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
        state.edges.set(edgeKey, { sourceId: 'herald-agent', targetId: id, active: true, lastActive: Date.now(), direction: 'in' })
        newParticles.push({ edgeKey, t: 0, dir: 'in' })
      }
    })

    particlesRef.current = [...particlesRef.current, ...newParticles]
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

    let pulse = 0

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

      nodes.forEach((node, i) => {
        if (node.type === 'agent') { node.x = cx; node.y = cy; return }
        const peers = nodes.filter(n => n.type === node.type)
        const idx   = peers.indexOf(node)
        const count = peers.length
        if (node.type === 'source') {
          node.x = cx - W * 0.3
          node.y = cy - ((count - 1) * 40) / 2 + idx * 40
        } else {
          node.x = cx + W * 0.3
          node.y = cy - ((count - 1) * 40) / 2 + idx * 40
        }
      })

      const nodeMap = new Map(nodes.map(n => [n.id, n]))

      // Draw edges
      state.edges.forEach((edge) => {
        const src = nodeMap.get(edge.sourceId)
        const tgt = nodeMap.get(edge.targetId)
        if (!src || !tgt || src.x == null || tgt.x == null) return

        const age = edge.lastActive ? Date.now() - edge.lastActive : 999999
        const opacity = age < 2000 ? 0.8 : 0.2

        ctx.beginPath()
        ctx.moveTo(src.x!, src.y!)
        ctx.lineTo(tgt.x!, tgt.y!)
        ctx.strokeStyle = edge.direction === 'out'
          ? `rgba(39,117,202,${opacity})`
          : `rgba(77,255,210,${opacity})`
        ctx.lineWidth = 1
        ctx.stroke()
      })

      // Animate particles along edges
      particlesRef.current = particlesRef.current
        .map(p => ({ ...p, t: p.t + 0.015 }))
        .filter(p => p.t <= 1)

      particlesRef.current.forEach(particle => {
        const edge = state.edges.get(particle.edgeKey)
        if (!edge) return
        const src = nodeMap.get(edge.sourceId)
        const tgt = nodeMap.get(edge.targetId)
        if (!src || !tgt || src.x == null || tgt.x == null) return

        const x = src.x! + (tgt.x! - src.x!) * particle.t
        const y = src.y! + (tgt.y! - src.y!) * particle.t
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fillStyle = particle.dir === 'out' ? '#2775CA' : '#4DFFD2'
        ctx.globalAlpha = 1 - particle.t * 0.5
        ctx.fill()
        ctx.globalAlpha = 1
      })

      // Draw nodes
      nodes.forEach(node => {
        if (node.x == null) return
        let radius: number, color: string, label: string

        if (node.type === 'agent') {
          radius = 18 + Math.sin(pulse) * 3
          color  = '#2775CA'
          label  = 'HERALD'
        } else if (node.type === 'source') {
          radius = Math.min(6 + node.totalUsd * 1000, 14)
          color  = '#2775CA'
          label  = node.label
        } else {
          radius = Math.min(6 + node.totalUsd * 1000, 14)
          color  = '#4DFFD2'
          label  = node.label
        }

        // Glow
        const grd = ctx.createRadialGradient(node.x!, node.y!, 0, node.x!, node.y!, radius * 2.5)
        grd.addColorStop(0, color + '40')
        grd.addColorStop(1, color + '00')
        ctx.beginPath()
        ctx.arc(node.x!, node.y!, radius * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        // Circle
        ctx.beginPath()
        ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2)
        ctx.fillStyle = node.type === 'agent' ? color : 'var(--bg-card, #0D1424)'
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = node.type === 'agent' ? 2 : 1.5
        ctx.stroke()

        // Label
        ctx.fillStyle = node.type === 'agent' ? '#fff' : 'var(--text-data, #94A3B8)'
        ctx.font = node.type === 'agent' ? 'bold 10px Inter' : '9px Inter'
        ctx.textAlign = 'center'
        ctx.fillText(label.slice(0, 12), node.x!, node.y! + radius + 14)
      })

      pulse += 0.04
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      ro.disconnect()
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
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ flex: 1, width: '100%', borderRadius: 8, background: '#070B14' }}
      />
    </div>
  )
}
