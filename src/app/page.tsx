import type { Metadata } from "next";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import Hero from "@/components/marketing/Hero";
import DemoVideo from "@/components/marketing/DemoVideo";
import HowItWorks from "@/components/marketing/HowItWorks";
import BusinessTypes from "@/components/marketing/BusinessTypes";
import FeaturedBusinesses from "@/components/marketing/FeaturedBusinesses";
import ProductPreview from "@/components/marketing/ProductPreview";
import Pricing from "@/components/marketing/Pricing";
import WhyKivo from "@/components/marketing/WhyKivo";
import FinalCTA from "@/components/marketing/FinalCTA";
import { TrackMarketingPageView } from "@/components/marketing/TrackedLink";

export const metadata: Metadata = {
  title: "Kivo — Managed booking for your business",
  description:
    "A professional booking system for your business — set up and managed for you. Accept bookings online, keep your calendar organised and keep customers updated automatically.",
  openGraph: {
    title: "Kivo — Managed booking for your business",
    description:
      "Bookings, without the back-and-forth. First month free, then Rs 1,000/month. Setup and support included.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <TrackMarketingPageView />
      <main id="main">
        <Hero />
        <DemoVideo />
        <FeaturedBusinesses />
        <HowItWorks />
        <BusinessTypes />
        <ProductPreview />
        <Pricing />
        <WhyKivo />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </>
  );
}
