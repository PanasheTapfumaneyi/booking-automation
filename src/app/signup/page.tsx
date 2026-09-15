import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";
import { TrackMarketingPageView } from "@/components/marketing/TrackedLink";

export const metadata: Metadata = {
  title: "Create your business account",
  description: "Set up online booking for your business on Kivo.",
};

export default function SignupPage() {
  return (
    <>
      <Navbar />
      <TrackMarketingPageView />
      <main className="flex-1">
        <Suspense>
          <LoginForm mode="signup" />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
