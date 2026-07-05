"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, CornerDownLeft } from "lucide-react"
import { motion } from "framer-motion"
import { useSafeReducedMotion } from "./useSafeReducedMotion"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

const exampleTopics = [
  "AI regulation in the EU...",
  "DeFi lending markets...",
  "Climate adaptation financing...",
  "Semiconductor supply chains...",
  "Agent-to-agent payment protocols...",
]

const stack = ["Circle Wallets", "Arc Testnet", "x402 Protocol", "1Claw Vault", "Google Gemini"]

export function Hero() {
  const shouldReduceMotion = useSafeReducedMotion()
  const router = useRouter()
  const [topic, setTopic] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  const [displayText, setDisplayText] = useState("")
  const [promptIndex, setPromptIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    if (topic || isFocused || shouldReduceMotion) {
      setDisplayText("")
      return
    }

    const currentPrompt = exampleTopics[promptIndex]
    let charIndex = 0
    let timeout: NodeJS.Timeout

    if (isTyping) {
      timeout = setInterval(() => {
        if (charIndex <= currentPrompt.length) {
          setDisplayText(currentPrompt.slice(0, charIndex))
          charIndex++
        } else {
          clearInterval(timeout)
          setTimeout(() => setIsTyping(false), 2000)
        }
      }, 50)
    } else {
      charIndex = currentPrompt.length
      timeout = setInterval(() => {
        if (charIndex >= 0) {
          setDisplayText(currentPrompt.slice(0, charIndex))
          charIndex--
        } else {
          clearInterval(timeout)
          setPromptIndex((prev) => (prev + 1) % exampleTopics.length)
          setIsTyping(true)
        }
      }, 30)
    }

    return () => clearInterval(timeout)
  }, [promptIndex, isTyping, topic, isFocused, shouldReduceMotion])

  function deployWithTopic() {
    const trimmed = topic.trim()
    router.push(trimmed.length >= 3 ? `/deploy?topic=${encodeURIComponent(trimmed)}` : "/deploy")
  }

  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  }

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      <div className="absolute inset-0 -z-10 hero-glow pointer-events-none" />

      <div className="flex-1 flex items-center justify-center pt-28 lg:pt-32 pb-40 sm:pb-32">
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={shouldReduceMotion ? {} : fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-display text-balance mb-6 leading-[1.1] font-display"
          >
            <span className="text-gradient-lime">The agent that pays to learn</span>
            <br />
            <span className="text-foreground">and sells what it knows</span>
          </motion.h1>

          <motion.p
            initial={shouldReduceMotion ? {} : fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty leading-relaxed px-2"
          >
            HERALD is an autonomous research agent with its own crypto wallet. It pays a fraction of a
            cent for every source it reads via real x402 nanopayments on Arc, synthesizes what it learns,
            and sells the brief to other agents — a live, two-sided micro-economy, not a demo of one.
          </motion.p>

          <motion.div
            initial={shouldReduceMotion ? {} : fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="max-w-2xl mx-auto mb-6"
          >
            <div className="relative bg-card border border-border rounded-xl overflow-hidden shadow-[0_0_30px_rgba(217,249,157,0.15),0_0_60px_rgba(217,249,157,0.08)]">
              <div className="relative">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => e.key === "Enter" && deployWithTopic()}
                  placeholder=""
                  aria-label="What should your agent research?"
                  className="w-full bg-transparent px-4 sm:px-5 py-3 sm:py-4 pr-24 sm:pr-32 text-foreground focus:outline-none text-sm sm:text-base"
                />
                {!topic && !isFocused && (
                  <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 pointer-events-none text-sm sm:text-base text-muted-foreground truncate max-w-[55%] sm:max-w-none">
                    {displayText}
                    <span className="inline-block w-[2px] h-[1em] bg-primary ml-0.5 animate-pulse align-middle" />
                  </div>
                )}
                {!topic && isFocused && (
                  <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 pointer-events-none text-sm sm:text-base text-muted-foreground/50">
                    What should your agent research?
                  </div>
                )}
              </div>
              <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 text-muted-foreground/50 text-xs">
                  <CornerDownLeft className="w-3 h-3" />
                </div>
                <Button size="sm" rounded="lg" onClick={deployWithTopic}>
                  Deploy
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? {} : fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button size="xl" rounded="full" className="gap-2 w-full sm:w-auto" onClick={deployWithTopic}>
              Deploy Your Agent
              <ArrowRight className="w-4 h-4" />
            </Button>
            <a href="/economy">
              <Button variant="outline" size="xl" rounded="full" className="gap-2 bg-transparent w-full sm:w-auto">
                Watch the Live Economy
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="absolute bottom-0 left-0 right-0 py-6 sm:py-8 border-t border-border/30 bg-background/80 backdrop-blur-sm"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs sm:text-sm text-muted-foreground/60 mb-4 sm:mb-6 text-center">
            Real infrastructure, not a simulation
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-12 gap-y-3 sm:gap-y-4">
            {stack.map((name) => (
              <span
                key={name}
                className="font-mono text-xs sm:text-sm md:text-base text-muted-foreground/60 hover:text-muted-foreground/90 transition-colors"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  )
}
