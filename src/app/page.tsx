import { Navbar } from './components/landing/Navbar'
import { Hero } from './components/landing/Hero'
import { HowItWorks } from './components/landing/HowItWorks'
import { UseCases } from './components/landing/UseCases'
import { Stats } from './components/landing/Stats'
import { Economics } from './components/landing/Economics'
import { FAQ } from './components/landing/FAQ'
import { FinalCTA } from './components/landing/FinalCTA'
import { Footer } from './components/landing/Footer'

export default function Home() {
  return (
    <main className="relative z-0 min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <Hero />
      <HowItWorks />
      <UseCases />
      <Stats />
      <Economics />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  )
}
