import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardShell from "@/components/dashboard/DashboardShell";
import StorefrontEditor from "@/components/storefront/StorefrontEditor";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { fetchBusiness } from "@/lib/server/database";
import { getSupabase } from "@/lib/supabase/server";
import { getBusinessSettings } from "@/lib/server/businesses";
import { parseTheme } from "@/lib/server/business-theme";
import {
  getStorefrontBundle,
  listReviews,
  listTeam,
} from "@/lib/server/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Storefront",
  description: "Customize how customers see your business.",
  robots: { index: false, follow: false },
};

/**
 * Storefront editor: appearance, content, gallery, team, social links,
 * amenities, and section visibility for the currently selected business.
 * Presentation only — bookings, services, and integrations live in
 * Settings and the bookings area.
 */
export default async function StorefrontPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>;
}) {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/dashboard/storefront");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const params = await searchParams;
  const requestedBusiness =
    params.business && params.business.trim().length > 0 ? params.business : null;
  if (requestedBusiness && !memberships.some((m) => m.business_id === requestedBusiness)) {
    notFound();
  }
  const selectedId = (requestedBusiness ? requestedBusiness : memberships[0].business_id) as string;

  const db = getSupabase();
  const business = await fetchBusiness(selectedId, db).catch(() => null);
  if (!business) redirect("/onboarding");
  const settings = await getBusinessSettings(selectedId, db).catch(() => null);
  if (!settings) redirect("/onboarding");

  const [bundle, teamAll, reviewsAll] = await Promise.all([
    getStorefrontBundle(selectedId, db).catch(() => ({
      storefront: null,
      gallery: [],
      team: [],
      reviews: [],
    })),
    listTeam(selectedId, db, { all: true }).catch(() => []),
    listReviews(selectedId, db, { all: true }).catch(() => []),
  ]);

  const theme = parseTheme(settings.business.theme_config);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper">
        <DashboardShell
          businessId={business.id}
          businessName={business.name}
          businessSlug={business.slug}
        >
          <StorefrontEditor
            key={business.id}
            initial={{
              business: {
                id: business.id,
                name: business.name,
                slug: business.slug,
                isActive: settings.business.is_active,
                logoUrl: settings.business.logo_url,
                coverUrl: settings.business.cover_image_url,
                tagline: settings.business.tagline,
                description: settings.business.description,
                hasHours: settings.business.availability !== null,
                category: business.category ?? null,
                themePrimary: theme.primary,
                themeAccent: theme.accent,
              },
              storefront: bundle.storefront,
              gallery: bundle.gallery,
              team: teamAll,
              reviews: reviewsAll,
            }}
          />
        </DashboardShell>
      </main>
      <Footer />
    </>
  );
}
