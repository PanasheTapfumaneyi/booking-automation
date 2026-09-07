/**
 * Public business site data loader (server-side).
 *
 * Powers `/business/[slug]` — the lightweight public profile page every
 * business gets, separate from the booking flow at `/book/[slug]`.
 * Only intended-public columns are read (no customers, no bookings,
 * no tokens).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchBusinessBySlug, type BusinessRow } from "./database";
import {
  listServices,
  listResources,
  listSessions,
  type ServiceSummary,
  type ResourceSummary,
  type SessionSummary,
} from "./businesses";

type DbLike = Pick<SupabaseClient, "from" | "rpc">;

export interface BusinessSiteData {
  business: BusinessRow;
  /** Active services only. */
  services: ServiceSummary[];
  /** Active resources only. */
  resources: ResourceSummary[];
  /** Active future sessions only, soonest first. */
  sessions: SessionSummary[];
}

export async function getBusinessSiteData(
  slug: string,
  db: DbLike,
): Promise<BusinessSiteData | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const business = await fetchBusinessBySlug(clean, db as never).catch(() => null);
  if (!business) return null;

  const client = db as never;
  const [services, resources, sessions] = await Promise.all([
    listServices(business.id, client).catch(() => []),
    listResources(business.id, client).catch(() => []),
    listSessions(business.id, client).catch(() => []),
  ]);

  const now = Date.now();
  return {
    business,
    services: services.filter((s) => s.active),
    resources: resources.filter((r) => r.active),
    sessions: sessions
      .filter((s) => s.active && Date.parse(s.start_time) >= now)
      .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time)),
  };
}
