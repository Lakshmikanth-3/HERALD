"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X, ArrowRight, Zap } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#economics", label: "Economics" },
  { href: "#faq", label: "FAQ" },
]

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileMenuOpen])

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav className="mx-auto max-w-6xl px-2 sm:px-4 lg:px-8 py-4" aria-label="Main navigation">
        <div className="flex h-14 items-center justify-between bg-background/60 backdrop-blur-xl border border-border/50 rounded-full px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="HERALD home">
            <Zap className="w-5 sm:w-6 h-5 sm:h-6 text-primary" aria-hidden="true" />
            <span className="font-display font-bold text-base sm:text-lg text-foreground" style={{ letterSpacing: "-0.03em" }}>
              HERALD
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/economy">
              <Button variant="ghost" size="sm" rounded="full">
                Live Economy
              </Button>
            </Link>
            <Link href="/deploy">
              <Button size="sm" rounded="full" className="gap-1.5">
                Deploy an Agent
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </Link>
          </div>

          <button
            type="button"
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 top-0 left-0 w-dvw h-dvh bg-background z-40 flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation menu"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-background border-b border-border/50">
                <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                  <Zap className="w-5 h-5 text-primary" aria-hidden="true" />
                  <span className="font-display font-bold text-base text-foreground" style={{ letterSpacing: "-0.03em" }}>
                    HERALD
                  </span>
                </Link>
                <button
                  type="button"
                  className="p-2 text-foreground hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" aria-hidden="true" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-4 py-3 text-base text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-foreground/10"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="px-6 py-4 border-t border-border/50 bg-background flex flex-col gap-3">
                <Link href="/economy" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" rounded="lg" className="justify-center text-base py-6 w-full">
                    Live Economy
                  </Button>
                </Link>
                <Link href="/deploy" onClick={() => setMobileMenuOpen(false)}>
                  <Button rounded="full" className="py-6 text-base w-full">
                    Deploy an Agent
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  )
}
