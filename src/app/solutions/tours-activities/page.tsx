import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Tour & Activity Booking System Mauritius — Kivo",
  description:
    "Let customers book tours, classes and group activities online. Kivo manages capacity, sends confirmations and keeps your schedule organised for tour operators in Mauritius.",
  alternates: { canonical: `${SITE_URL}/solutions/tours-activities` },
  openGraph: {
    title: "Tour & Activity Booking System Mauritius — Kivo",
    description:
      "Let customers book tours, classes and group activities online. Kivo manages capacity, sends confirmations and keeps your schedule organised.",
    url: `${SITE_URL}/solutions/tours-activities`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tour & Activity Booking System Mauritius — Kivo",
    description:
      "Let customers book tours, classes and group activities online. Kivo manages capacity, sends confirmations and keeps your schedule organised.",
    images: [OG_IMAGE],
  },
};

const PROBLEMS = [
  "Manually tracking how many spots are left for each session",
  "Customers showing up without booking and overcrowding sessions",
  "No way to fill last-minute cancellations",
  "WhatsApp groups cluttered with booking requests",
];

export default function ToursActivitiesPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Tours &amp; Activities
          </p>
          <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
            Booking system for tours, classes and group activities
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Kivo is an online booking system for tour operators, swim schools,
            surf instructors and activity providers in Mauritius. Customers book
            sessions with live capacity — no phone calls, no confusion about
            availability.
          </p>

          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Common problems
            </h2>
            <ul className="mt-4 space-y-3">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-ink-soft">
                  <span className="mt-1 text-red-500">✕</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              How Kivo handles group bookings
            </h2>
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="font-semibold text-ink">Capacity management</h3>
                <p className="mt-1 text-ink-soft">
                  Set a maximum capacity for each session. Kivo tracks remaining
                  spots and stops accepting bookings when full.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Schedule display</h3>
                <p className="mt-1 text-ink-soft">
                  Customers see upcoming sessions with dates, times and remaining
                  spots. They pick a session and book instantly.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Automatic confirmations</h3>
                <p className="mt-1 text-ink-soft">
                  Every booking sends a WhatsApp confirmation. Customers know
                  exactly when and where to show up.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Session management</h3>
                <p className="mt-1 text-ink-soft">
                  Add new sessions, adjust capacity, or cancel a session — all
                  from your dashboard. Changes reflect immediately.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-line bg-surface-muted p-6">
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">See it in action.</span>{" "}
              Visit the{" "}
              <Link href="/business/blue-lagoon" className="text-brand hover:underline">
                Blue Lagoon Swim School demo
              </Link>{" "}
              to see a real capacity-based booking page, or try the{" "}
              <Link href="/book/blue-lagoon" className="text-brand hover:underline">
                booking flow
              </Link>{" "}
              as a customer.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-7 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
            >
              Start your free month
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-7 py-3.5 text-base font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
            >
              View pricing
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
