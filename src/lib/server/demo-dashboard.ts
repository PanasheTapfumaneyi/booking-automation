/**
 * Read-only demo dashboard loader (server-side).
 *
 * Powers `/demo/dashboard/[slug]`. Strictly presentational: no mutations,
 * no auth, no secrets. Only `is_demo = true` businesses resolve —
 * anything else returns null (the page maps it to a safe 404), so demo
 * routes can never expose production business data.
 *
 * Customer privacy: visitor bookings are real rows, so contact details
 * are masked here (first name + partially hidden phone, email dropped).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchBusinessBySlug, type BusinessRow } from "./database";
import { isDemoBusiness } from "./demo";
import {
  listBusinessBookings,
  getBusinessDayBounds,
  type BusinessBooking,
} from "./business-bookings";
import {
  listServices,
  listResources,
  listSessions,
  type ServiceSummary,
  type ResourceSummary,
  type SessionSummary,
} from "./businesses";

type DbLike = Pick<SupabaseClient, "from" | "rpc">;

export interface DemoDashboardBooking {
  id: string;
  startTime: string;
  endTime: string;
  status: BusinessBooking["status"];
  serviceName: string;
  quantity: number;
  resourceName: string | null;
  sessionStartTime: string | null;
  /** First name only — never the full name. */
  customerDisplay: string;
  /** Last 2 digits only, e.g. "•••• ••56". */
  phoneDisplay: string;
}

export interface DemoDashboardData {
  business: BusinessRow;
  todayKey: string;
  today: DemoDashboardBooking[];
  upcoming: DemoDashboardBooking[];
  services: ServiceSummary[];
  resources: ResourceSummary[];
  sessions: SessionSummary[];
}

export function maskCustomerName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first || "Guest";
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const tail = digits.slice(-2);
  return tail ? `•••• ••${tail}` : "••••";
}

function toDemoBooking(b: BusinessBooking): DemoDashboardBooking {
  return {
    id: b.id,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    serviceName: b.serviceName,
    quantity: b.quantity,
    resourceName: b.resourceName,
    sessionStartTime: b.sessionStartTime,
    customerDisplay: maskCustomerName(b.customerName),
    phoneDisplay: maskPhone(b.customerPhone),
  };
}

export async function getDemoDashboardData(
  slug: string,
  db: DbLike,
): Promise<DemoDashboardData | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const business = await fetchBusinessBySlug(clean, db as never).catch(() => null);
  // Server-side gate: demo flag only. Non-demo and unknown slugs → 404.
  if (!business || !isDemoBusiness(business)) return null;

  const client = db as never;
  const bounds = getBusinessDayBounds(business.timezone, new Date());
  const [todayRows, upcomingRows, services, resources, sessions] = await Promise.all([
    listBusinessBookings(
      business.id,
      { statuses: ["confirmed", "rescheduled"], fromIso: bounds.dayStartUtc, toIso: bounds.dayEndUtc, limit: 50 },
      client,
    ).catch((): BusinessBooking[] => []),
    listBusinessBookings(
      business.id,
      { statuses: ["confirmed", "rescheduled"], fromIso: bounds.dayEndUtc, limit: 10 },
      client,
    ).catch((): BusinessBooking[] => []),
    listServices(business.id, client).catch(() => []),
    listResources(business.id, client).catch(() => []),
    listSessions(business.id, client).catch(() => []),
  ]);

  return {
    business,
    todayKey: bounds.todayKey,
    today: todayRows.map(toDemoBooking),
    upcoming: upcomingRows.map(toDemoBooking),
    services: services.filter((s) => s.active),
    resources: resources.filter((r) => r.active),
    sessions: sessions.filter((s) => s.active),
  };
}
