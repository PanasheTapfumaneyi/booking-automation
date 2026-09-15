import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { TrackedLink } from "@/components/marketing/TrackedLink";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import { fetchBusiness } from "@/lib/server/database";
import { getSetupRequest } from "@/lib/server/onboarding";
import { whatsappUrl } from "@/lib/marketing-config";
import { PRICING } from "@/lib/marketing-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Setup underway",
  description: "Kivo is setting up your booking system.",
  robots: { index: false, follow: false },
};

const PENDING = ["pending_setup", "contacted", "setting_up"] as const;

/**
 * Managed-setup success screen. Rendered from the persisted setup state,
 * so refresh/retry shows the same screen without duplicating the request.
 */
export default async function SetupSuccessPage() {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/onboarding/success");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const businessId = memberships[0].business_id as string;
  const db = getSupabase();
  const [business, setup] = await Promise.all([
    fetchBusiness(businessId, db).catch(() => null),
    getSetupRequest(businessId, db).catch(() => null),
  ]);
  if (!business) redirect("/onboarding");
  if (!setup || !(PENDING as readonly string[]).includes(setup.status)) {
    redirect("/dashboard");
  }

  const wa = whatsappUrl(
    `Hi, I'm ${business.name} — I'd like to get started with my Kivo setup.`,
  );

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-xl px-5 py-12 text-center sm:py-16">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue text-white">
            <span className="text-2xl font-bold" aria-hidden="true">✓</span>
          </div>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Managed setup
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Your Kivo setup is underway
          </h1>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-soft">
            We&apos;ve received {business.name}&apos;s details. We&apos;ll
            contact you on WhatsApp shortly to learn a little more about how
            your business works and finish setting up your booking system.
          </p>

          <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
            {wa && (
              <TrackedLink
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                eventName="contact_clicked"
                eventProps={{ contact_type: "whatsapp", cta_location: "onboarding_success" }}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong"
              >
                Message Kivo on WhatsApp
              </TrackedLink>
            )}
            <Link
              href="/dashboard"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-line bg-card px-6 py-3.5 text-base font-medium transition-colors hover:border-blue/50"
            >
              Open dashboard
            </Link>
          </div>

          <p className="mt-6 text-sm text-ink-soft">
            Want to get started sooner? Message us any time.
          </p>
          <p className="mt-4 rounded-xl border border-line bg-card px-4 py-3 text-sm text-ink-soft">
            Your first month is free. No payment is required to get started —
            {` ${PRICING.monthlyPrice}`} only after your trial.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
