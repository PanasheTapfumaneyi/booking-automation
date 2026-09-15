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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your page is ready to explore",
  description: "Your temporary Kivo booking page is ready.",
  robots: { index: false, follow: false },
};

/**
 * Self-configuration completion screen. Rendered from persisted state
 * (ready_for_review), so refresh is safe. Kivo involvement stays visible:
 * nothing here implies the owner is on their own.
 */
export default async function SetupCompletePage() {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/onboarding/complete");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const businessId = memberships[0].business_id as string;
  const db = getSupabase();
  const [business, setup] = await Promise.all([
    fetchBusiness(businessId, db).catch(() => null),
    getSetupRequest(businessId, db).catch(() => null),
  ]);
  if (!business) redirect("/onboarding");
  if (!setup || setup.status !== "ready_for_review") {
    redirect(setup && setup.status === "self_configuring" ? "/onboarding" : "/dashboard");
  }

  const wa = whatsappUrl(
    `Hi, I'm ${business.name} — I've finished configuring my Kivo page and would like a review.`,
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
            Self configuration
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Your Kivo page is ready to explore
          </h1>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-soft">
            Your temporary booking page is ready. You can test bookings,
            explore your dashboard and make changes while we finish setting
            things up.
          </p>
          <p className="mx-auto mt-2 max-w-md leading-relaxed text-ink-soft">
            We&apos;ll contact you shortly to help review and finalize your
            setup before you go live.
          </p>

          <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
            {business.slug && (
              <TrackedLink
                href={`/business/${business.slug}`}
                eventName="temporary_business_page_viewed"
                eventProps={{ cta_location: "complete_page" }}
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong"
              >
                View my booking page
              </TrackedLink>
            )}
            <Link
              href="/dashboard"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-line bg-card px-6 py-3.5 text-base font-medium transition-colors hover:border-blue/50"
            >
              Open dashboard
            </Link>
            {wa && (
              <TrackedLink
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                eventName="contact_clicked"
                eventProps={{ contact_type: "whatsapp", cta_location: "complete_page" }}
                className="text-sm font-medium text-ink-soft hover:text-ink"
              >
                Message Kivo
              </TrackedLink>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
