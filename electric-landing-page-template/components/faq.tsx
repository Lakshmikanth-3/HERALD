"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    question: "How quickly can I deploy an AI support agent?",
    answer:
      "Most teams have their first AI agent live within 30 minutes. Simply connect your knowledge base, customize responses, and deploy. No coding required.",
  },
  {
    question: "Can Electric integrate with my existing tools?",
    answer:
      "Yes! Electric integrates with popular helpdesks like Zendesk, Intercom, and Freshdesk, plus CRMs like Salesforce and HubSpot. We also offer a REST API for custom integrations.",
  },
  {
    question: "What happens when the AI can't answer a question?",
    answer:
      "Electric seamlessly escalates to human agents when needed, providing full conversation context. You can customize escalation rules based on sentiment, topic, or customer tier.",
  },
  {
    question: "How does Electric learn from my data?",
    answer:
      "Electric uses your knowledge base, past tickets, and FAQs to train custom models. The AI continuously improves from agent corrections and customer feedback.",
  },
  {
    question: "Is my customer data secure?",
    answer:
      "Absolutely. Electric is SOC 2 Type II certified and GDPR compliant. All data is encrypted at rest and in transit. We never use your data to train models for other customers.",
  },
]

export function FAQ() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-display mb-4">
            Frequently asked <span className="text-gradient-lime">questions</span>
          </h2>
          <p className="text-muted-foreground">Everything you need to know about Electric</p>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-border rounded-xl px-6 bg-card/30"
              >
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
