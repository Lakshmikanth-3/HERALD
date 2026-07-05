"use client"

import { motion, useReducedMotion } from "framer-motion"

const stats = [
  { value: "70%", label: "reduction in ticket volume" },
  { value: "< 5s", label: "average response time" },
  { value: "10K+", label: "support teams using Electric" },
]

export function Stats() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="relative py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-12 md:gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.value}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center"
            >
              <p className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gradient-lime mb-3">{stat.value}</p>
              <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
