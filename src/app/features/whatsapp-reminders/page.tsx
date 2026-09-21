import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "WhatsApp Booking Reminders — Kivo",
  description:
    "Every booking sends an automatic WhatsApp confirmation. Reminders go out before appointments to reduce no-shows. Built into every Kivo plan.",
  alternates: { canonical: `${SITE_URL}/features/whatsapp-reminders` },
  openGraph: {
    title: "WhatsApp Booking Reminders — Kivo",
    description:
      "Every booking sends an automatic WhatsApp confirmation. Reminders go out before appointments to reduce no-shows.",
    url: `${SITE_URL}/features/whatsapp-reminders`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WhatsApp Booking Reminders — Kivo",
    description:
      "Every booking sends an automatic WhatsApp confirmation. Reminders go out before appointments to reduce no-shows.",
    images: [OG_IMAGE],
  },
};

export default function WhatsAppRemindersPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Feature
          </p>
          <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
            WhatsApp booking confirmations and reminders
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Every booking on Kivo sends an automatic WhatsApp confirmation to
            your customer. They get the date, time and business details
            instantly — no manual follow-up needed.
          </p>

          <div className="mt-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Instant confirmations
              </h2>
              <p className="mt-3 text-ink-soft">
                As soon as a customer books, they receive a WhatsApp message
                confirming their booking. The message includes the business name,
                service, date and time. Customers feel confident their booking
                is confirmed.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Automated reminders
              </h2>
              <p className="mt-3 text-ink-soft">
                Reminder messages go out before each appointment. Customers
                remember their bookings, and you spend less time chasing
                confirmations. Fewer no-shows means more revenue.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Reschedule and cancellation updates
              </h2>
              <p className="mt-3 text-ink-soft">
                When a customer reschedules or cancels, they get a WhatsApp
                update. Everyone stays on the same page without phone calls or
                messages.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                Built into every plan
              </h2>
              <p className="mt-3 text-ink-soft">
                WhatsApp confirmations and reminders are included in every Kivo
                plan at no extra cost. There are no per-message fees or third
                party accounts needed.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              How it works
            </h2>
            <ol className="mt-4 space-y-4 text-ink-soft">
              <li className="flex gap-3">
                <span className="font-bold text-brand">1.</span>
                Customer books on your Kivo booking page.
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brand">2.</span>
                They instantly receive a WhatsApp confirmation with all the
                details.
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brand">3.</span>
                Before the appointment, Kivo sends a reminder.
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brand">4.</span>
                You get notified of the booking — no manual work needed.
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
