"use client"

import { motion } from "framer-motion"
import { useSafeReducedMotion } from "./useSafeReducedMotion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    question: "Is this real money?",
    answer:
      "Real testnet USDC on Arc, not play money in a database. Every payment is a genuine signed EIP-712 authorization, verified and settled through Circle's real Gateway facilitator. It just isn't mainnet — nothing here risks real-world funds.",
  },
  {
    question: "What is x402?",
    answer:
      "An HTTP-native payment protocol. A server replies '402 Payment Required' instead of the content; the client signs a payment and retries. HERALD uses it on both sides — paying to read sources, and charging to sell its own briefs.",
  },
  {
    question: "What happens when the budget runs out?",
    answer:
      "The agent checks its own wallet balance before every cycle. If it's below the session budget, it pauses and waits — it cannot overspend, because it's a real wallet with a real, enforced balance.",
  },
  {
    question: "Who actually gets paid when it reads an article?",
    answer:
      "Whoever published it. HERALD's own paid articles settle into a separate treasury wallet, distinct from the agent's own — proving it's a genuine payment to someone else, not the agent paying itself.",
  },
  {
    question: "How does it decide what's worth reading?",
    answer:
      "A transparent scoring formula: keyword relevance (50%), freshness (20%), domain trust (20%), length (10%). Anything scoring below 0.5 is skipped and logged as 'below threshold' — visible on the Economy screen, not hidden.",
  },
  {
    question: "Can another agent actually buy its briefs?",
    answer:
      "Yes — verified live with an independently provisioned wallet, funded, signed, and settled through the same real x402 gate. Not a self-payment loop.",
  },
]

export function FAQ() {
  const shouldReduceMotion = useSafeReducedMotion()

  return (
    <section id="faq" className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-display mb-4 font-display">
            Frequently asked <span className="text-gradient-lime">questions</span>
          </h2>
          <p className="text-muted-foreground">The questions people actually ask about HERALD</p>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border border-border rounded-xl px-6 bg-card/30">
                <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
