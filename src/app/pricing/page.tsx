import type { Metadata } from "next";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import Pricing from "@/components/marketing/Pricing";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Pricing — Kivo booking system for Mauritian businesses",
  description:
    "Simple, transparent pricing for Kivo. Start with a free month, then an affordable monthly plan. Setup and support included.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Pricing — Kivo booking system for Mauritian businesses",
    description:
      "Simple, transparent pricing for Kivo. Start with a free month, then an affordable monthly plan. Setup and support included.",
    url: `${SITE_URL}/pricing`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Kivo booking system for Mauritian businesses",
    description:
      "Simple, transparent pricing for Kivo. Start with a free month, then an affordable monthly plan. Setup and support included.",
    images: [OG_IMAGE],
  },
};

export default function PricingPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <Pricing />
      </main>
      <MarketingFooter />
    </>
  );
}
