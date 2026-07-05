"use client"

import { motion, useReducedMotion } from "framer-motion"

const logos = [
  { name: "TechCrunch", text: "TechCrunch" },
  { name: "Forbes", text: "Forbes" },
  { name: "Wired", text: "WIRED" },
  { name: "The Verge", text: "The Verge" },
  { name: "Product Hunt", text: "Product Hunt" },
]

export function LogoCloud() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="relative py-12 lg:py-16 border-t border-border" aria-label="Featured in">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={shouldReduceMotion ? {} : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mb-8"
        >
          Trusted by teams at
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {logos.map((logo, index) => (
            <motion.div
              key={logo.name}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <span className="text-lg font-semibold tracking-tight">{logo.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
