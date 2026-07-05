import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { VideoGallery } from "@/components/video-gallery"
import { HowItWorks } from "@/components/how-it-works"
import { UseCases } from "@/components/use-cases"
import { Stats } from "@/components/stats"
import { Testimonials } from "@/components/testimonials"
import { Pricing } from "@/components/pricing"
import { FAQ } from "@/components/faq"
import { FinalCTA } from "@/components/final-cta"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="relative z-0 min-h-screen bg-background overflow-x-hidden">
      <div
        className="absolute top-0 right-0 w-[1500px] h-[1500px] -z-10 bg-primary pointer-events-none"
        style={{
          maskImage: "radial-gradient(ellipse 50% 50% at 100% 0%, rgb(0 0 0 / 0.75), transparent)",
        }}
      >
        <div className="absolute inset-0 bg-cover bg-right-top" style={{ backgroundImage: "url('/grade.png')" }} />
      </div>

      <Navbar />

      <Hero />
      <VideoGallery />
      <HowItWorks />
      <UseCases />
      <Stats />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  )
}
