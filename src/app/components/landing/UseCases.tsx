"use client"

import { motion } from "framer-motion"
import { useSafeReducedMotion } from "./useSafeReducedMotion"
import { Cpu, LineChart, Landmark, FlaskConical, Coins, Globe } from "lucide-react"

const useCases = [
  { category: "Technology", question: "What do recent AI agent deployments reveal about enterprise adoption?", icon: Cpu },
  { category: "Finance", question: "Where is adaptation financing actually landing, and where is it stalling?", icon: LineChart },
  { category: "Politics", question: "What do draft AI regulations in the EU actually say, line by line?", icon: Landmark },
  { category: "Science", question: "What's the real state of semiconductor supply chain resilience?", icon: FlaskConical },
  { category: "Crypto", question: "How are stablecoin settlement rails actually compared at sub-cent scale?", icon: Coins },
  { category: "General", question: "What's a fair way to price machine-to-machine content markets?", icon: Globe },
]

const allUseCases = [...useCases, ...useCases]

export function UseCases() {
  const shouldReduceMotion = useSafeReducedMotion()

  return (
    <section id="features" className="relative py-12 sm:py-20 overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-primary/15"
        style={{
          maskImage: "radial-gradient(ellipse 55% 55%, rgb(0 0 0 / 0.75), transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 55% 55%, rgb(0 0 0 / 0.75), transparent)",
        }}
      />

      <div className="text-center mb-8 sm:mb-12 px-4">
        <motion.h2
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 font-display"
        >
          What will you point it at?
        </motion.h2>
        <motion.p
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto"
        >
          Any topic works — HERALD scores relevance across free RSS feeds and its own paid shelf
        </motion.p>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div className="mb-4">
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex gap-3 sm:gap-4 animate-marquee"
            style={{ width: "fit-content" }}
          >
            {allUseCases.map((useCase, i) => (
              <UseCaseCard key={`row1-${i}`} useCase={useCase} />
            ))}
          </motion.div>
        </div>

        <div>
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex gap-3 sm:gap-4 animate-marquee"
            style={{ width: "fit-content", animationDirection: "reverse", animationDuration: "70s" }}
          >
            {[...allUseCases].reverse().map((useCase, i) => (
              <UseCaseCard key={`row2-${i}`} useCase={useCase} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function UseCaseCard({ useCase }: { useCase: (typeof useCases)[0] }) {
  const Icon = useCase.icon

  return (
    <div className="group relative flex-shrink-0 w-64 sm:w-80 p-4 sm:p-5 bg-card border border-border rounded-xl transition-all duration-300 cursor-pointer hover:border-primary/50 hover:bg-card/80 hover:shadow-[0_0_30px_-5px] hover:shadow-primary/20 hover:-translate-y-1 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative flex items-center gap-2 mb-2 sm:mb-3">
        <div className="p-1.5 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">{useCase.category}</span>
      </div>
      <p className="relative text-xs sm:text-sm text-foreground leading-relaxed group-hover:text-foreground/90">
        {useCase.question}
      </p>
    </div>
  )
}
