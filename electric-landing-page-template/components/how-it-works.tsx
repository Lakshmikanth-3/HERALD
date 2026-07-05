"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Upload, Sparkles, MessageSquare } from "lucide-react"

const steps = [
  {
    icon: Upload,
    title: "Connect",
    description: "Import your knowledge base, FAQs, and past tickets. Electric learns your business instantly.",
  },
  {
    icon: Sparkles,
    title: "Train",
    description: "Our AI customizes responses to match your brand voice and support policies automatically.",
  },
  {
    icon: MessageSquare,
    title: "Deploy",
    description: "Go live across chat, email, and social. AI handles inquiries 24/7 while you focus on growth.",
  },
]

export function HowItWorks() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-display mb-4">
            How it <span className="text-gradient-lime">works</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">From setup to live support in three simple steps</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="relative text-center"
            >
              <div className="relative inline-block mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-primary text-background flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
