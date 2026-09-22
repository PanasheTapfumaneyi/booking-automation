import type { Metadata } from "next";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import Hero from "@/components/marketing/Hero";
import DemoVideo from "@/components/marketing/DemoVideo";
import HowItWorks from "@/components/marketing/HowItWorks";
import BusinessTypes from "@/components/marketing/BusinessTypes";
import FeaturedBusinesses from "@/components/marketing/FeaturedBusinesses";
import ProductPreview from "@/components/marketing/ProductPreview";
import PricingCards from "@/components/marketing/PricingCards";
import WhyKivo from "@/components/marketing/WhyKivo";
import FinalCTA from "@/components/marketing/FinalCTA";
import { TrackMarketingPageView } from "@/components/marketing/TrackedLink";
import { SITE_URL } from "@/lib/site-config";
import { JsonLdScript } from "@/lib/seo-jsonld";

export const metadata: Metadata = {
  title: "Online Booking System for Mauritian Businesses | Kivo",
  description:
    "Kivo gives Mauritian businesses a professional booking website, automated WhatsApp reminders, Google Calendar syncing and simple booking management.",
  openGraph: {
    title: "Online Booking System for Mauritian Businesses | Kivo",
    description:
      "Professional booking websites, WhatsApp reminders and calendar syncing for businesses in Mauritius. Set up and managed for you.",
    url: SITE_URL,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Kivo — Online booking system for Mauritian businesses" }],
  },
  twitter: {
    title: "Online Booking System for Mauritian Businesses | Kivo",
    description:
      "Professional booking websites, WhatsApp reminders and calendar syncing for businesses in Mauritius. Set up and managed for you.",
    images: ["/og.png"],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kivo",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  description:
    "Managed online booking system for businesses in Mauritius.",
  areaServed: {
    "@type": "Country",
    name: "Mauritius",
  },
  serviceType: [
    "Online Booking System",
    "Booking Management Software",
    "WhatsApp Booking Reminders",
    "Google Calendar Integration",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Kivo",
  url: SITE_URL,
  description:
    "Professional online booking system for Mauritian businesses.",
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Online Booking System",
  provider: {
    "@type": "Organization",
    name: "Kivo",
    url: SITE_URL,
  },
  areaServed: {
    "@type": "Country",
    name: "Mauritius",
  },
  name: "Kivo — Managed Online Booking System",
  description:
    "A professional booking website for your business in Mauritius — set up and managed for you. Accept bookings online, send WhatsApp confirmations and sync with Google Calendar.",
};

export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <TrackMarketingPageView />
      <JsonLdScript data={organizationJsonLd} />
      <JsonLdScript data={websiteJsonLd} />
      <JsonLdScript data={serviceJsonLd} />
      <main id="main">
        <Hero />
        <DemoVideo />
        <FeaturedBusinesses />
        <HowItWorks />
        <BusinessTypes />
        <ProductPreview />
        <PricingCards />
        <WhyKivo />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </>
  );
}
