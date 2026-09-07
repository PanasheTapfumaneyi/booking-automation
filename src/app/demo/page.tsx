import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata: Metadata = {
  title: "Try Kivo — Live Demos",
  description:
    "See how Kivo works for different business types. Try appointment booking, resource rental, or capacity-based class scheduling.",
};

const DEMOS = [
  {
    slug: "fade-area",
    mode: "Appointments",
    title: "Fade Area",
    desc: "See how a service business handles time-based bookings.",
    details: "Barbershop &middot; Haircuts, beard trims & consultations",
    cta: "Book appointment",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="20" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 2V5M17 2V5M2 9.5H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    slug: "island-surf",
    mode: "Rentals",
    title: "Island Surf Co.",
    desc: "Try booking a surfboard or other reservable resource.",
    details: "Surf school &middot; Surfboards & paddleboards",
    cta: "Book a rental",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 15.5L5.5 7C6 5.5 7.5 4.5 9 4.5H15C16.5 4.5 18 5.5 18.5 7L21 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="2" y="15" width="20" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="7" cy="20" r="1.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="17" cy="20" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    slug: "blue-lagoon",
    mode: "Classes & Tours",
    title: "Blue Lagoon Swim School",
    desc: "Join a scheduled session with limited capacity.",
    details: "Swim school &middot; Group lessons & kids sessions",
    cta: "Book a class",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 21C4 17.13 7.13 14 12 14C16.87 14 20 17.13 20 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function DemoPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[1200px] px-6 py-20 sm:py-28">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Live demos</p>
            <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
              Try Kivo in action
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              Choose a business type below to experience the real Kivo booking flow.
              Each demo uses a real booking engine&mdash;not a mockup. For every
              business you can visit its public page, book as a customer, and
              inspect a read-only business dashboard.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {DEMOS.map((demo) => (
              <div
                key={demo.slug}
                className="group flex flex-col rounded-2xl border border-line bg-card p-6"
              >
                <div className="flex items-start justify-between">
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                    {demo.mode}
                  </span>
                  <span className="text-brand transition-transform duration-200 group-hover:-translate-y-0.5">
                    {demo.icon}
                  </span>
                </div>
                <h2 className="mt-5 text-xl font-bold text-ink">{demo.title}</h2>
                <p className="mt-2 flex-1 leading-relaxed text-ink-soft">{demo.desc}</p>
                <div className="mt-5 border-t border-line pt-4">
                  <p
                    className="text-xs text-muted"
                    dangerouslySetInnerHTML={{ __html: demo.details }}
                  />
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    href={`/business/${demo.slug}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:border-brand hover:text-brand"
                  >
                    View business page
                  </Link>
                  <Link
                    href={`/book/${demo.slug}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
                  >
                    {demo.cta}
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
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-line bg-surface-muted px-6 py-5">
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">Demo data only.</span>{" "}
              Bookings made here use fictional data. No real WhatsApp messages or calendar events will be sent.
              You can explore the full booking experience safely.
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
