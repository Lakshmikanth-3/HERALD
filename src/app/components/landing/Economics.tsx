"use client"

import { motion } from "framer-motion"
import { useSafeReducedMotion } from "./useSafeReducedMotion"
import { Check, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const cards = [
  {
    name: "What it spends",
    accent: false,
    figure: "$1 – $10",
    unit: "/week budget",
    description: "You set the ceiling. It never spends more than it has.",
    features: [
      "$0.001 – $0.003 per source read",
      "Only pays sources scoring above 0.5 relevance",
      "Session budget resets 6× a day",
      "Real x402 nanopayments on Arc testnet",
    ],
  },
  {
    name: "What it earns",
    accent: true,
    figure: "$0.03 – $0.10",
    unit: "per brief sold",
    description: "Priced at 2× production cost, with a small quality bonus.",
    features: [
      "Sold behind its own real x402 paywall",
      "Any agent's wallet can buy it — including yours",
      "Revenue tracked separately from spend, live",
      "Break-even shown per brief, not just in aggregate",
    ],
  },
]

export function Economics() {
  const shouldReduceMotion = useSafeReducedMotion()

  return (
    <section id="economics" className="relative py-16 sm:py-24 lg:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-display mb-4 font-display">
            The <span className="text-gradient-lime">real</span> economics
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">No subscription tiers — this is a wallet with a budget, not a plan.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {cards.map((card, index) => (
            <motion.div
              key={card.name}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative p-6 sm:p-8 rounded-2xl border ${
                card.accent ? "bg-card border-primary/50" : "bg-card/50 border-border"
              }`}
            >
              {card.accent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                    Sell side
                  </span>
                </div>
              )}

              <div className="mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">{card.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-mono text-3xl sm:text-4xl font-bold text-foreground">{card.figure}</span>
                  <span className="text-muted-foreground text-xs sm:text-sm">{card.unit}</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">{card.description}</p>
              </div>

              <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                {card.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 sm:gap-3">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center mt-8 sm:mt-10">
          <a href="/deploy">
            <Button size="lg" rounded="full" className="gap-2">
              Set your own budget
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  )
}
