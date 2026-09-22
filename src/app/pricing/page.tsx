import type { Metadata } from "next";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import PricingCards from "@/components/marketing/PricingCards";
import FeatureComparison from "@/components/marketing/FeatureComparison";
import PricingFAQ from "@/components/marketing/PricingFAQ";
import FinalCTA from "@/components/marketing/FinalCTA";
import { AI_FEATURES } from "@/lib/marketing-config";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Kivo Pricing Mauritius — Plans from Rs 900/month",
  description:
    "Compare Kivo Base, Plus and Premium plans for Mauritian businesses. Get online bookings, WhatsApp reminders, Google Calendar integration, SEO support and AI early access.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Kivo Pricing Mauritius — Plans from Rs 900/month",
    description:
      "Compare Kivo Base, Plus and Premium plans for Mauritian businesses. Get online bookings, WhatsApp reminders, Google Calendar integration, SEO support and AI early access.",
    url: `${SITE_URL}/pricing`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kivo Pricing Mauritius — Plans from Rs 900/month",
    description:
      "Compare Kivo Base, Plus and Premium plans for Mauritian businesses. Get online bookings, WhatsApp reminders, Google Calendar integration, SEO support and AI early access.",
    images: [OG_IMAGE],
  },
};

export default function PricingPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-paper">
          <div className="mx-auto max-w-[1200px] px-6 pt-24 pb-8 sm:pt-32">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
              Pricing
            </p>
            <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
              Try Kivo free for 1 month.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
              Plans from Rs 900/month. Choose the level of support that fits your business.
            </p>
          </div>
        </section>

        {/* Three pricing cards (no duplicate intro — hero above) */}
        <PricingCards showIntro={false} showComparisonLink={false} />

        {/* Feature comparison table */}
        <FeatureComparison />

        {/* SEO support explanation */}
        <section className="bg-paper">
          <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.1] tracking-tight text-ink">
              How Kivo helps your business get found
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
              Plus plans include search optimisation, storefront setup, and Google Business
              Profile assistance. We don&apos;t guarantee rankings — visibility depends on
              competition, reviews, your business information, and Google&apos;s systems.
            </p>
          </div>
        </section>

        {/* Premium AI early-access section */}
        <section className="bg-surface-muted">
          <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue">
                Premium
              </p>
              <h2 className="mt-4 text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.1] tracking-tight text-ink">
                AI early access
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-soft">
                Premium includes everything in Plus, plus dedicated onboarding, custom
                consultations, and early access to new automation features. AI capabilities
                are currently in development and will roll out progressively.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-line bg-card p-6">
                <h3 className="text-base font-bold text-ink">Currently included</h3>
                <ul className="mt-4 space-y-2.5">
                  {[
                    "Advanced business and booking insights",
                    "Dedicated priority onboarding",
                    "Custom workflow consultation",
                    "Custom automation consultation",
                    "Early access to new Kivo automation features",
                    "Dedicated priority support",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-ink-soft">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-brand" aria-hidden="true">
                        <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-blue/20 bg-blue-mist p-6">
                <h3 className="text-base font-bold text-ink">Coming soon with AI early access</h3>
                <ul className="mt-4 space-y-2.5">
                  {AI_FEATURES.map((feat) => (
                    <li key={feat.id} className="flex items-start gap-3 text-sm text-ink-soft">
                      <span className="mt-0.5 shrink-0 text-blue text-xs" aria-hidden="true">◷</span>
                      {feat.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <PricingFAQ />

        {/* Final CTA */}
        <FinalCTA />
      </main>
      <MarketingFooter />
    </>
  );
}
