"use client"

import { motion } from "framer-motion"
import { useSafeReducedMotion } from "./useSafeReducedMotion"
import { Search, Gauge, Wallet, Sparkles, Send } from "lucide-react"

const steps = [
  {
    icon: Search,
    title: "Discover",
    description: "Checks free news feeds and its own paid article shelf for anything matching your topic.",
  },
  {
    icon: Gauge,
    title: "Score",
    description: "Rates each source 0–1 on relevance, freshness, and domain trust. Below 0.5, it's ignored.",
  },
  {
    icon: Wallet,
    title: "Buy",
    description: "If a source asks for payment, it signs a real x402 payment and unlocks it — $0.001–$0.003 a time.",
  },
  {
    icon: Sparkles,
    title: "Synthesize",
    description: "Feeds everything it bought to Gemini, which writes a short, sourced research brief.",
  },
  {
    icon: Send,
    title: "Publish",
    description: "Locks the brief behind its own x402 paywall, priced at roughly 2× what it cost to make.",
  },
]

export function HowItWorks() {
  const shouldReduceMotion = useSafeReducedMotion()

  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-display mb-4 font-display">
            The loop it runs, <span className="text-gradient-lime">every few hours</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Five steps, fully autonomous. `POST /api/agent/run` triggers one manually; a scheduler fires it every 4 hours.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-8 relative">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative text-center"
            >
              <div className="relative inline-block mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-primary text-background flex items-center justify-center text-xs font-bold font-mono">
                  {index + 1}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2 font-display">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
