import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import OnboardingFlow from "@/components/OnboardingFlow";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up your business",
  description: "Create your business and start taking bookings.",
};

/** First-run setup. Owners with a business already go to the dashboard. */
export default async function OnboardingPage() {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/onboarding");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length > 0) redirect("/dashboard");

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <OnboardingFlow />
      </main>
      <Footer />
    </>
  );
}
