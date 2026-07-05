import type { Metadata } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import BackendStatusBanner from './components/BackendStatusBanner'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'HERALD — The Agent That Pays to Learn and Sells What It Knows',
  description: 'An autonomous AI research agent with its own wallet. It pays for every source it reads and earns by selling synthesized briefs to other agents.',
  openGraph: {
    title: 'HERALD Agent',
    description: 'Autonomous AI research with x402 nanopayments on Arc',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-base text-foreground antialiased">
        <BackendStatusBanner />
        {children}
      </body>
    </html>
  )
}
