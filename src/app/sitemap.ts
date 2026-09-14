import type { MetadataRoute } from "next";
import { getSupabase } from "@/lib/supabase/server";
import { listPublicBusinessSlugs } from "@/lib/server/public-site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const staticPages: MetadataRoute.Sitemap = ["", "/signup", "/login", "/book", "/demo"].map(
    (path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
    }),
  );

  let businesses: Array<{ slug: string }> = [];
  try {
    businesses = await listPublicBusinessSlugs(getSupabase());
  } catch {
    businesses = [];
  }

  const businessPages: MetadataRoute.Sitemap = businesses.map((b) => ({
    url: `${baseUrl}/business/${b.slug}`,
    lastModified: new Date(),
  }));

  return [...staticPages, ...businessPages];
}
