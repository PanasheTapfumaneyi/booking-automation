import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { TrackMarketingPageView } from "@/components/marketing/TrackedLink";
import { FEATURED_BUSINESSES } from "@/lib/marketing-config";

export const metadata: Metadata = {
  title: "Live booking sites — see how booking works",
  description:
    "Explore real booking flows for different business types. Each site uses the full Kivo engine — not a mockup.",
};

const DEMO_DETAILS: Record<string, { details: string; cta: string }> = {
  "fade-area": {
    details: "Barbershop · Haircuts, beard trims & consultations",
    cta: "Book appointment",
  },
  "kivo-drive": {
    details: "Car rental · 5 vehicles · daily rates",
    cta: "Rent a car",
  },
  "island-surf": {
    details: "Surf school · Surfboards & paddleboards",
    cta: "Book a board",
  },
  "blue-lagoon": {
    details: "Swim school · Group lessons & kids sessions",
    cta: "Book a class",
  },
};

export default function DemoPage() {
  return (
    <>
      <MarketingHeader />
      <TrackMarketingPageView />
      <main className="flex-1">
        <section className="mx-auto max-w-[1200px] px-6 py-20 sm:py-28">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Live booking sites</p>
            <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
              See Kivo in action
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              Choose a business below to experience the real Kivo booking flow.
              Each one uses a real booking engine — not a mockup. Visit the
              public page, book as a customer, and explore the dashboard.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURED_BUSINESSES.map((demo) => {
              const detail = DEMO_DETAILS[demo.slug] ?? { details: demo.category, cta: "Book now" };
              return (
                <div
                  key={demo.slug}
                  className="group flex flex-col rounded-2xl border border-line bg-card p-6"
                >
                  <div className="flex items-start justify-between">
                    <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                      {demo.modeLabel}
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-ink">{demo.name}</h2>
                  <p className="mt-2 flex-1 leading-relaxed text-ink-soft">{demo.description}</p>
                  <div className="mt-5 border-t border-line pt-4">
                    <p className="text-xs text-muted">{detail.details}</p>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      href={`/business/${demo.slug}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:border-brand hover:text-brand"
                    >
                      View business
                    </Link>
                    <Link
                      href={`/book/${demo.slug}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
                    >
                      {detail.cta}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                    <Link
                      href={`/demo/dashboard/${demo.slug}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition-colors duration-150 hover:text-ink"
                    >
                      View business dashboard
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 rounded-2xl border border-line bg-surface-muted px-6 py-5">
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">Demo data only.</span>{" "}
              Bookings made here use fictional data. No real WhatsApp messages or
              calendar events will be sent. You can explore the full booking
              experience safely.
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
