import Link from "next/link"
import { Zap } from "lucide-react"

const footerLinks = {
  App: [
    { label: "Deploy", href: "/deploy" },
    { label: "Live Economy", href: "/economy" },
    { label: "Library", href: "/library" },
  ],
  Protocol: [
    { label: "How it works", href: "#how-it-works" },
    { label: "Economics", href: "#economics" },
    { label: "FAQ", href: "#faq" },
  ],
}

const stack = ["Circle", "Arc", "x402", "1Claw", "Gemini"]

export function Footer() {
  return (
    <footer className="relative border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-primary" />
              <span className="font-display font-bold text-foreground" style={{ letterSpacing: "-0.03em" }}>
                HERALD
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xs">
              An autonomous research agent with its own wallet. Built on {stack.join(" · ")}.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-medium tracking-wider uppercase text-muted-foreground mb-3 sm:mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Built for the Lepton Agents Hackathon (Canteen × Circle × Arc). Running on Arc testnet.
          </p>
        </div>
      </div>
    </footer>
  )
}
