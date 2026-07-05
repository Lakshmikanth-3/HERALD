"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Megaphone, ShoppingCart, CreditCard, RefreshCw, HelpCircle, Clock, Globe, Shield } from "lucide-react"

const useCases = [
  {
    category: "E-commerce",
    question: "How can we handle order tracking and shipping inquiries automatically?",
    icon: ShoppingCart,
  },
  {
    category: "Billing",
    question: "Need to automate subscription management and payment questions?",
    icon: CreditCard,
  },
  {
    category: "Returns",
    question: "Want to streamline refund requests and return processes?",
    icon: RefreshCw,
  },
  {
    category: "FAQ",
    question: "How do we deflect common questions before they reach agents?",
    icon: HelpCircle,
  },
  {
    category: "24/7 Support",
    question: "Need round-the-clock support without overnight staffing?",
    icon: Clock,
  },
  {
    category: "Multilingual",
    question: "Want to support customers in multiple languages instantly?",
    icon: Globe,
  },
  {
    category: "Compliance",
    question: "Looking to ensure consistent, compliant responses every time?",
    icon: Shield,
  },
  {
    category: "Outreach",
    question: "How can we proactively engage customers before issues arise?",
    icon: Megaphone,
  },
]

// Duplicate for seamless loop
const allUseCases = [...useCases, ...useCases]

export function UseCases() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="features" className="relative py-12 sm:py-20 overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-primary/25"
        style={{
          maskImage: "radial-gradient(ellipse 55% 55%, rgb(0 0 0 / 0.75), transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 55% 55%, rgb(0 0 0 / 0.75), transparent)",
        }}
      >
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/grade.png')" }} />
      </div>

      <div className="text-center mb-8 sm:mb-12 px-4">
        <motion.h2
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4"
        >
          What will you automate?
        </motion.h2>
        <motion.p
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto"
        >
          From simple FAQs to complex workflows, Electric handles it all
        </motion.p>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        {/* First row - scrolls left */}
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

        {/* Second row - scrolls right (reversed) */}
        <div>
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex gap-3 sm:gap-4 animate-marquee"
            style={{
              width: "fit-content",
              animationDirection: "reverse",
              animationDuration: "70s",
            }}
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
      {/* Subtle inner gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* Icon and category row */}
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
