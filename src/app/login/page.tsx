import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";
import { TrackMarketingPageView } from "@/components/marketing/TrackedLink";

export const metadata: Metadata = {
  title: "Business login",
  description: "Business login — manage your business on Kivo.",
};

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <TrackMarketingPageView />
      <main className="flex-1">
        <Suspense>
          <LoginForm mode="login" />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
