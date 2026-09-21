import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Salon & Barber Booking System Mauritius — Kivo",
  description:
    "A booking system built for salons and barbershops in Mauritius. Customers book haircuts, trims and consultations online. WhatsApp confirmations keep no-shows down.",
  alternates: { canonical: `${SITE_URL}/solutions/salons-barbers` },
  openGraph: {
    title: "Salon & Barber Booking System Mauritius — Kivo",
    description:
      "A booking system built for salons and barbershops in Mauritius. Customers book haircuts, trims and consultations online.",
    url: `${SITE_URL}/solutions/salons-barbers`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Salon & Barber Booking System Mauritius — Kivo",
    description:
      "A booking system built for salons and barbershops in Mauritius. Customers book haircuts, trims and consultations online.",
    images: [OG_IMAGE],
  },
};

const PROBLEMS = [
  "Walk-ins waiting while booked clients get served",
  "Phone ringing during appointments — no one to answer",
  "Empty slots because customers forgot to rebook",
  "Manual appointment books that are hard to share with staff",
];

export default function SalonsBarbersPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Salons &amp; Barbers
          </p>
          <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
            Booking system for salons and barbershops
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Kivo is an online booking system designed for salons and barbershops
            in Mauritius. Customers pick a service — haircut, beard trim,
            consultation — choose a time and book instantly. You get a
            professional booking page without hiring a developer.
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
              What Kivo does for your salon
            </h2>
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="font-semibold text-ink">Online bookings 24/7</h3>
                <p className="mt-1 text-ink-soft">
                  Customers can book anytime — even after hours. No missed calls,
                  no voicemails, no manual scheduling.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">
                  WhatsApp confirmations
                </h3>
                <p className="mt-1 text-ink-soft">
                  Every booking sends a WhatsApp confirmation to the customer.
                  Reminders go out before the appointment to reduce no-shows.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Service menus</h3>
                <p className="mt-1 text-ink-soft">
                  List your services with durations and prices. Customers see
                  exactly what they&apos;re booking and how long it takes.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-ink">Your own booking URL</h3>
                <p className="mt-1 text-ink-soft">
                  Get a professional booking page at kivoconsulting.site/business/your-salon.
                  Share it on Instagram, Google, or your website.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-line bg-surface-muted p-6">
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">See it in action.</span>{" "}
              Visit the{" "}
              <Link href="/business/fade-area" className="text-brand hover:underline">
                Fade Area demo
              </Link>{" "}
              to see a real salon booking page, or try the{" "}
              <Link href="/book/fade-area" className="text-brand hover:underline">
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
