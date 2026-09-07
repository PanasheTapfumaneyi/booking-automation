import type { Metadata } from "next";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import Hero from "@/components/marketing/Hero";
import HowItWorks from "@/components/marketing/HowItWorks";
import BusinessTypes from "@/components/marketing/BusinessTypes";
import ProductPreview from "@/components/marketing/ProductPreview";
import WhyKivo from "@/components/marketing/WhyKivo";
import FinalCTA from "@/components/marketing/FinalCTA";

export const metadata: Metadata = {
  title: "Kivo — Simple digital booking for businesses",
  description:
    "Kivo gives your customers a simple way to book online while giving you one place to manage your availability, services and reservations.",
  openGraph: {
    title: "Kivo — Simple digital booking for businesses",
    description:
      "Bookings, without the back-and-forth. One place for bookings, availability, customers and resources.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <Hero />
        <HowItWorks />
        <BusinessTypes />
        <ProductPreview />
        <WhyKivo />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </>
  );
}
