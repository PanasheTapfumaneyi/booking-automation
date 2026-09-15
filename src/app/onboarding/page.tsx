import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import OnboardingFlow from "@/components/OnboardingFlow";
import BasicsForm from "@/components/onboarding/BasicsForm";
import ChoiceScreen from "@/components/onboarding/ChoiceScreen";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import { fetchBusiness } from "@/lib/server/database";
import { getSetupRequest } from "@/lib/server/onboarding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up your business",
  description: "Create your business and start taking bookings.",
};

/**
 * Onboarding state router. Returning users resume exactly where they
 * left off; businesses WITHOUT a setup row are existing tenants and go
 * straight to the dashboard (live by absence — never reclassified).
 *
 *   no membership            → business basics
 *   setup row missing        → dashboard (existing business)
 *   new                      → setup choice (managed vs self)
 *   self_configuring         → detailed configuration flow
 *   pending/contacted/etc    → dashboard (status banner takes over)
 */
export default async function OnboardingPage() {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/onboarding");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) {
    return (
      <>
        <Navbar />
        <main className="flex-1">
          <BasicsForm />
        </main>
        <Footer />
      </>
    );
  }

  const businessId = memberships[0].business_id as string;
  const db = getSupabase();
  const business = await fetchBusiness(businessId, db).catch(() => null);
  if (!business) {
    return (
      <>
        <Navbar />
        <main className="flex-1">
          <BasicsForm />
        </main>
        <Footer />
      </>
    );
  }

  const setup = await getSetupRequest(business.id, db).catch(() => null);
  if (!setup) redirect("/dashboard");
  if (setup.status === "new") {
    return (
      <>
        <Navbar />
        <main className="flex-1">
          <ChoiceScreen
            businessId={business.id}
            businessName={business.name}
            initialContact={business.phone ?? setup.contact_phone ?? ""}
          />
        </main>
        <Footer />
      </>
    );
  }
  if (setup.status === "self_configuring") {
    return (
      <>
        <Navbar />
        <main className="flex-1">
          <OnboardingFlow
            businessId={business.id}
            bookingMode={business.booking_mode}
            markCompleteUrl="/api/onboarding/complete"
            completionHref="/onboarding/complete"
          />
        </main>
        <Footer />
      </>
    );
  }
  redirect("/dashboard");
}
