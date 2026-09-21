import type { MetadataRoute } from "next";
import { getSupabase } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getSupabase();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL },
    { url: `${SITE_URL}/demo` },
    { url: `${SITE_URL}/pricing` },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/contact` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
    { url: `${SITE_URL}/solutions/appointments` },
    { url: `${SITE_URL}/solutions/salons-barbers` },
    { url: `${SITE_URL}/solutions/car-rentals` },
    { url: `${SITE_URL}/solutions/tours-activities` },
    { url: `${SITE_URL}/features/whatsapp-reminders` },
    { url: `${SITE_URL}/features/google-calendar` },
  ];

  let businesses: Array<{ slug: string; updated_at: string | null; is_demo: boolean | null }> = [];
  try {
    const { data } = await db
      .from("businesses")
      .select("slug, updated_at, is_demo")
      .not("slug", "is", null)
      .or("is_active.is.null,is_active.eq.true");
    businesses = (data ?? []) as typeof businesses;
  } catch {
    businesses = [];
  }

  const businessPages: MetadataRoute.Sitemap = businesses
    .filter((b) => b.slug && b.is_demo !== true)
    .map((b) => ({
      url: `${SITE_URL}/business/${b.slug}`,
      lastModified: b.updated_at ? new Date(b.updated_at) : undefined,
    }));

  return [...staticPages, ...businessPages];
}
