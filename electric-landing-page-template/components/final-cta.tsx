"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FinalCTA() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
      <div
        className="relative max-w-5xl mx-auto bg-background rounded-3xl overflow-hidden py-16 lg:py-24 px-6 sm:px-12"
        style={{
          border: "1px dashed",
          borderColor: "oklch(0.92 0.16 130 / 0.4)",
          borderDasharray: "12 8",
        }}
      >
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-display mb-6 text-foreground">
              Ready to transform your customer support?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Start with 1,000 free conversations. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="xl" rounded="full" className="gap-2 min-w-[200px]">
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="xl" rounded="full" className="gap-2 min-w-[200px] bg-transparent">
                Talk to Sales
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
