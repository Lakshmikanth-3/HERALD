"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useSafeReducedMotion } from "./useSafeReducedMotion"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

interface LiveStats {
  briefsPublished: number
  paymentsLogged: number
  usdcMoved: number
}

export function Stats() {
  const shouldReduceMotion = useSafeReducedMotion()
  const [stats, setStats] = useState<LiveStats | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [briefsRes, paymentsRes] = await Promise.all([
          fetch(`${API}/api/briefs?limit=100`),
          fetch(`${API}/api/agent/payments?limit=100`),
        ])
        const briefs = briefsRes.ok ? await briefsRes.json() : []
        const payments = paymentsRes.ok ? await paymentsRes.json() : []
        if (cancelled) return
        setStats({
          briefsPublished: briefs.length,
          paymentsLogged: payments.length,
          usdcMoved: payments.reduce((sum: number, p: { amountUsd: number }) => sum + p.amountUsd, 0),
        })
      } catch {
        if (!cancelled) setStats({ briefsPublished: 0, paymentsLogged: 0, usdcMoved: 0 })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const items = [
    { value: stats ? String(stats.briefsPublished) : "—", label: "research briefs published" },
    { value: stats ? String(stats.paymentsLogged) : "—", label: "real x402 payments logged" },
    { value: stats ? `$${stats.usdcMoved.toFixed(3)}` : "—", label: "real testnet USDC moved" },
  ]

  return (
    <section className="relative py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-mono uppercase tracking-widest text-muted-foreground/60 mb-10">
          Live from this agent&apos;s own ledger — not a mockup
        </p>
        <div className="grid md:grid-cols-3 gap-12 md:gap-8">
          {items.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center"
            >
              <p className="font-mono text-5xl sm:text-6xl lg:text-7xl font-bold text-gradient-lime mb-3 tabular-nums">
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
