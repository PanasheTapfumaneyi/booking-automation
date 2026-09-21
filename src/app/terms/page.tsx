import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms and conditions for using the Kivo online booking platform for businesses in Mauritius.",
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    title: "Terms of Service — Kivo",
    description:
      "Terms and conditions for using the Kivo online booking platform for businesses in Mauritius.",
    url: `${SITE_URL}/terms`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — Kivo",
    description:
      "Terms and conditions for using the Kivo online booking platform for businesses in Mauritius.",
    images: [OG_IMAGE],
  },
};

export default function TermsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-28">
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            Last updated: September 2026
          </p>
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-ink-soft">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Acceptance of terms
            </h2>
            <p>
              By using Kivo, you agree to these terms of service. Kivo is a
              managed online booking platform for businesses in Mauritius.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              The service
            </h2>
            <p>
              Kivo provides a professional booking website, booking management
              dashboard, WhatsApp confirmations and reminders, and Google
              Calendar integration. Kivo handles the initial setup and ongoing
              maintenance of your booking system.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Account responsibilities
            </h2>
            <p>
              You are responsible for maintaining the security of your account
              and for all activities that occur under your account. You must
              provide accurate business information and keep it up to date.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Pricing and payments
            </h2>
            <p>
              Kivo offers a free trial period. After the trial, a monthly
              subscription fee applies. Current pricing is available on our
              pricing page. We reserve the right to change pricing with advance
              notice.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Cancellation
            </h2>
            <p>
              You may cancel your Kivo subscription at any time. Upon
              cancellation, your booking page will be deactivated. Your data
              will be retained for a reasonable period and can be exported on
              request.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Acceptable use
            </h2>
            <p>
              You must use Kivo in compliance with Mauritian law. You may not
              use the platform for illegal activities, to send spam, or in any
              way that could damage the service or other users.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Limitation of liability
            </h2>
            <p>
              Kivo is provided as-is. We work to keep the service reliable and
              available, but we cannot guarantee uninterrupted access. We are
              not liable for losses arising from use of the platform.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Changes to these terms
            </h2>
            <p>
              We may update these terms from time to time. Continued use of Kivo
              after changes are posted constitutes acceptance of the updated
              terms.
            </p>

            <div className="pt-4">
              <Link
                href="/contact"
                className="text-brand font-medium hover:underline"
              >
                Contact us with questions
              </Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
