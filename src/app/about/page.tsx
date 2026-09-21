import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About Kivo — Managed booking for Mauritian businesses",
  description:
    "Kivo is a managed online booking system built for businesses in Mauritius. We handle the setup so you can focus on your customers.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: "About Kivo — Managed booking for Mauritian businesses",
    description:
      "Kivo is a managed online booking system built for businesses in Mauritius. We handle the setup so you can focus on your customers.",
    url: `${SITE_URL}/about`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Kivo — Managed booking for Mauritian businesses",
    description:
      "Kivo is a managed online booking system built for businesses in Mauritius. We handle the setup so you can focus on your customers.",
    images: [OG_IMAGE],
  },
};

export default function AboutPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-28">
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
            About Kivo
          </h1>
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-ink-soft">
            <p>
              Kivo is a managed online booking system built for businesses in
              Mauritius. We believe every business — from barbershops to car
              rentals to tour operators — deserves a professional booking
              experience without the technical complexity.
            </p>
            <p>
              Our team handles the entire setup: your booking website, service
              listings, availability, WhatsApp confirmations and Google Calendar
              syncing. You focus on your customers; we handle the system behind
              the bookings.
            </p>
            <p>
              Kivo supports three booking modes — appointments, resource rentals
              and capacity-based sessions — so it works for salons, clinics,
              equipment hire, surf schools, swim classes and more.
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-ink pt-4">
              Our mission
            </h2>
            <p>
              To give every Mauritian business a simple, reliable way to accept
              bookings online — without hiring a developer, paying for expensive
              software, or learning a complicated system.
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-ink pt-4">
              How it works
            </h2>
            <p>
              Sign up, tell us about your business, and we set everything up for
              you. Your customers get a professional booking page. You get a
              dashboard to manage bookings, availability and customers. WhatsApp
              confirmations and reminders keep everyone on the same page.
            </p>
            <div className="pt-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-7 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
              >
                Start your free month
              </Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
