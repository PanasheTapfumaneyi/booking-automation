import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Car Rental Booking System Mauritius — Kivo",
  description:
    "Let customers browse your fleet, pick dates and reserve vehicles online. Kivo handles availability, confirmations and calendar sync for car rental businesses in Mauritius.",
  alternates: { canonical: `${SITE_URL}/solutions/car-rentals` },
  openGraph: {
    title: "Car Rental Booking System Mauritius — Kivo",
    description:
      "Let customers browse your fleet, pick dates and reserve vehicles online. Kivo handles availability, confirmations and calendar sync.",
    url: `${SITE_URL}/solutions/car-rentals`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Car Rental Booking System Mauritius — Kivo",
    description:
      "Let customers browse your fleet, pick dates and reserve vehicles online. Kivo handles availability, confirmations and calendar sync.",
    images: [OG_IMAGE],
  },
};

const PROBLEMS = [
  "Phone calls for every rental enquiry — even outside business hours",
  "Double-booking a vehicle because the calendar wasn't updated",
  "No way for customers to see what's available without calling",
  "Paper-based rental agreements that are hard to track",
];

export default function CarRentalsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Car Rentals
          </p>
          <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
            Online car rental booking system
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Kivo gives car rental businesses in Mauritius a professional online
            booking page. Customers browse your fleet, choose their dates and
            reserve a vehicle instantly. No phone calls required.
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
              How Kivo works for car rentals
            </h2>
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="font-semibold text-ink">Fleet showcase</h3>
                <p className="mt-1 text-ink-soft">
                  List each vehicle with photos, specs and daily rates. Customers
                  see your full fleet with availability at a glance.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Date-based availability</h3>
                <p className="mt-1 text-ink-soft">
                  Customers pick their pickup and return dates. Kivo checks
                  availability across your fleet in real time.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Instant confirmations</h3>
                <p className="mt-1 text-ink-soft">
                  Bookings are confirmed immediately with a WhatsApp message to
                  the customer and a notification to you.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">No double-bookings</h3>
                <p className="mt-1 text-ink-soft">
                  Once a vehicle is reserved for specific dates, it&apos;s blocked
                  for everyone else. Your calendar stays accurate.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-line bg-surface-muted p-6">
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">See it in action.</span>{" "}
              Visit the{" "}
              <Link href="/business/kivo-drive" className="text-brand hover:underline">
                Kivo Drive demo
              </Link>{" "}
              to see a real car rental booking page, or try the{" "}
              <Link href="/book/kivo-drive" className="text-brand hover:underline">
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
