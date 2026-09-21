import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Kivo collects, uses and protects your data. Read our privacy policy for the Kivo booking platform.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: "Privacy Policy — Kivo",
    description:
      "How Kivo collects, uses and protects your data. Read our privacy policy for the Kivo booking platform.",
    url: `${SITE_URL}/privacy`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy — Kivo",
    description:
      "How Kivo collects, uses and protects your data. Read our privacy policy for the Kivo booking platform.",
    images: [OG_IMAGE],
  },
};

export default function PrivacyPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-28">
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            Last updated: September 2026
          </p>
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-ink-soft">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Information we collect
            </h2>
            <p>
              When you create a Kivo account, we collect your email address and
              business information (name, phone number, timezone and business
              type). When your customers make bookings, we collect their name,
              contact details and booking details.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              How we use your information
            </h2>
            <p>
              We use your information to provide the Kivo service: managing your
              bookings, sending WhatsApp confirmations and reminders, syncing
              with Google Calendar, and displaying your public booking page.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Data sharing
            </h2>
            <p>
              We do not sell your data. We share information only as needed to
              provide the service — for example, sending a WhatsApp message to
              your customer when they make a booking, or syncing with Google
              Calendar when you enable that integration.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Data storage
            </h2>
            <p>
              Your data is stored securely using industry-standard infrastructure.
              We retain your data for as long as your account is active. You can
              request deletion of your data at any time.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Cookies
            </h2>
            <p>
              Kivo uses essential cookies to keep you logged in and to remember
              your preferences. We do not use advertising or tracking cookies.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Your rights
            </h2>
            <p>
              You can access, update or delete your data at any time through your
              Kivo dashboard or by contacting us. For data-related requests,
              reach out via WhatsApp or through the contact page.
            </p>

            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Changes to this policy
            </h2>
            <p>
              We may update this policy from time to time. Changes will be posted
              on this page with an updated date.
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
