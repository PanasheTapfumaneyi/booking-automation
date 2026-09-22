import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";
import { TrackMarketingPageView } from "@/components/marketing/TrackedLink";
import { isValidSignupPlanId } from "@/lib/marketing-config";

export const metadata: Metadata = {
  title: "Create your business account",
  description: "Set up online booking for your business on Kivo.",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const selectedPlan = isValidSignupPlanId(params.plan) ? params.plan : null;

  return (
    <>
      <Navbar />
      <TrackMarketingPageView />
      <main className="flex-1">
        {selectedPlan && (
          <div className="mx-auto max-w-md px-5 pt-6 text-center">
            <span className="inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              Selected plan: {selectedPlan === "base" ? "Base" : "Plus"}
            </span>
          </div>
        )}
        <Suspense>
          <LoginForm mode="signup" />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
