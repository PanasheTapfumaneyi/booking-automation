import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Google Calendar Integration — Kivo",
  description:
    "Connect Kivo to your Google Calendar. Bookings sync automatically so your real availability is always up to date. No double-bookings.",
  alternates: { canonical: `${SITE_URL}/features/google-calendar` },
  openGraph: {
    title: "Google Calendar Integration — Kivo",
    description:
      "Connect Kivo to your Google Calendar. Bookings sync automatically so your real availability is always up to date.",
    url: `${SITE_URL}/features/google-calendar`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Google Calendar Integration — Kivo",
    description:
      "Connect Kivo to your Google Calendar. Bookings sync automatically so your real availability is always up to date.",
    images: [OG_IMAGE],
  },
};

export default function GoogleCalendarPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Feature
          </p>
          <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
            Google Calendar integration
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Connect Kivo to your Google Calendar and never double-book again.
            Bookings sync automatically — when your calendar is busy, Kivo knows
            not to offer that time.
          </p>

          <div className="mt-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Two-way sync
              </h2>
              <p className="mt-3 text-ink-soft">
                When a customer books through Kivo, the event appears on your
                Google Calendar. When you add something to your calendar, Kivo
                blocks that time from being booked. Your real availability is
                always accurate.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                No double-bookings
              </h2>
              <p className="mt-3 text-ink-soft">
                If you have a dentist appointment at 10am, Kivo won&apos;t offer
                that slot to customers. Your personal and business calendar
                work together.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                One-click setup
              </h2>
              <p className="mt-3 text-ink-soft">
                Connecting Google Calendar takes seconds. Click &ldquo;Connect
                Google Calendar&rdquo; in your Kivo settings, sign in with your
                Google account and you&apos;re done. No technical knowledge
                needed.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Works with your existing calendar
              </h2>
              <p className="mt-3 text-ink-soft">
                You don&apos;t need to change how you manage your calendar. Kivo
                reads your existing events and works around them. Keep using
                Google Calendar the way you always have.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              How the integration works
            </h2>
            <ol className="mt-4 space-y-4 text-ink-soft">
              <li className="flex gap-3">
                <span className="font-bold text-brand">1.</span>
                Open your Kivo dashboard and go to Integrations.
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brand">2.</span>
                Click &ldquo;Connect Google Calendar&rdquo; and sign in.
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brand">3.</span>
                Choose which calendar Kivo should sync with.
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brand">4.</span>
                Kivo starts blocking busy times immediately. New bookings
                appear on your calendar.
              </li>
            </ol>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-7 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
            >
              Start your free month
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-7 py-3.5 text-base font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
            >
              See live demos
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
