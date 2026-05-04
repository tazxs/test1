import { Navbar } from '@components/layout/Navbar'
import { Footer } from '@components/layout/Footer'
import { HeroSection } from '@components/landing/HeroSection'
import { SocialProofBar } from '@components/landing/SocialProofBar'
import { ProblemSection } from '@components/landing/ProblemSection'
import { HowItWorksSection } from '@components/landing/HowItWorksSection'
import { FeaturesSection } from '@components/landing/FeaturesSection'
import { PricingSection } from '@components/landing/PricingSection'
import { TestimonialsSection } from '@components/landing/TestimonialsSection'
import { FAQSection } from '@components/landing/FAQSection'
import { CTASection } from '@components/landing/CTASection'

/**
 * Public marketing landing page.
 * Route: /
 * All 11 sections per DESIGN_SPEC.md § 2.
 */
export function Landing() {
  return (
    <div className="min-h-screen bg-navy">
      {/* Fixed navbar */}
      <Navbar />

      {/* Main content */}
      <main>
        {/* § 2.2 — Hero */}
        <HeroSection />

        {/* § 2.3 — Social proof bar */}
        <SocialProofBar />

        {/* § 2.4 — Problem */}
        <ProblemSection />

        {/* § 2.5 — How it works */}
        <HowItWorksSection />

        {/* § 2.6 — Features */}
        <FeaturesSection />

        {/* § 2.7 — Pricing */}
        <PricingSection />

        {/* § 2.8 — Testimonials */}
        <TestimonialsSection />

        {/* § 2.9 — FAQ */}
        <FAQSection />

        {/* § 2.10 — Final CTA */}
        <CTASection />
      </main>

      {/* § 2.11 — Footer */}
      <Footer />
    </div>
  )
}
