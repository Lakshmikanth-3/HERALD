"use client"

import { motion } from "framer-motion"
import { useSafeReducedMotion } from "./useSafeReducedMotion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FinalCTA() {
  const shouldReduceMotion = useSafeReducedMotion()

  return (
    <section className="py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
      <div
        className="relative max-w-5xl mx-auto bg-background rounded-3xl overflow-hidden py-16 lg:py-24 px-6 sm:px-12 border border-dashed border-primary/40"
      >
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-display mb-6 text-foreground font-display">
              Give it a topic. Watch it work.
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Set a weekly budget from $1 to $10 and HERALD handles the rest — reading, paying, writing, selling.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/deploy">
                <Button size="xl" rounded="full" className="gap-2 min-w-[200px]">
                  Deploy Your Agent
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <a href="/economy">
                <Button variant="outline" size="xl" rounded="full" className="gap-2 min-w-[200px] bg-transparent">
                  Watch the Live Economy
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
