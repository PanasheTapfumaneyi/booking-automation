/**
 * First-party marketing analytics reads (platform-admin only at the route
 * layer). All aggregates come from `marketing_events` — never from
 * operations_events (booking reliability stays separate).
 *
 * Aggregation happens in JS over a bounded recent window (10k rows). This
 * is plenty at Kivo's current scale; the upgrade path is a Postgres
 * aggregate function if traffic ever demands it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import { sanitizeMarketingProps } from "@/lib/marketing-attribution";

type DbLike = Pick<SupabaseClient, "from">;

function serviceDb(db?: DbLike): SupabaseClient {
  return (db ?? getSupabase()) as SupabaseClient;
}

export type MarketingRange = "today" | "7d" | "30d";

export function rangeStartIso(range: MarketingRange, nowMs = Date.now()): string {
  if (range === "today") {
    // UTC day boundary: deterministic in every timezone (reporting only).
    const now = new Date(nowMs);
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  }
  const days = range === "30d" ? 30 : 7;
  return new Date(nowMs - days * 86_400_000).toISOString();
}

interface MarketingRow {
  event_name: string;
  session_id: string;
  source: string | null;
  device: string | null;
  metadata: Record<string, unknown>;
}

const WINDOW_LIMIT = 10_000;

async function fetchWindow(
  startIso: string,
  db?: DbLike,
): Promise<MarketingRow[]> {
  const { data, error } = await serviceDb(db)
    .from("marketing_events")
    .select("event_name, session_id, source, device, metadata")
    .gte("created_at", startIso)
    .order("created_at", { ascending: false })
    .limit(WINDOW_LIMIT);
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>)
    .filter((row) => typeof row.event_name === "string")
    .map((row) => ({
      event_name: row.event_name as string,
      session_id: typeof row.session_id === "string" ? row.session_id : "",
      source: typeof row.source === "string" ? row.source : null,
      device: typeof row.device === "string" ? row.device : null,
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {},
    }));
}

function countBy(rows: MarketingRow[], eventName: string): number {
  return rows.filter((row) => row.event_name === eventName).length;
}

export interface MarketingOverview {
  visitors: number;
  startFreeClicks: number;
  signupStarts: number;
  accountsCreated: number;
  setupCompleted: number;
  /** accountsCreated / visitors, 0 when no visitors. */
  conversionRate: number;
}

export async function getMarketingOverview(
  range: MarketingRange,
  db?: DbLike,
): Promise<MarketingOverview> {
  const rows = await fetchWindow(rangeStartIso(range), db);
  const visitors = new Set(rows.map((row) => row.session_id).filter(Boolean)).size;
  const accountsCreated = countBy(rows, "signup_completed");
  return {
    visitors,
    startFreeClicks: countBy(rows, "start_free_clicked"),
    signupStarts: countBy(rows, "signup_started"),
    accountsCreated,
    setupCompleted: countBy(rows, "onboarding_completed"),
    conversionRate: visitors > 0 ? accountsCreated / visitors : 0,
  };
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

const FUNNEL: Array<{ key: string; label: string; events: string[] }> = [
  { key: "visitors", label: "Marketing visitors", events: [] },
  { key: "start_free", label: "Start Free clicked", events: ["start_free_clicked"] },
  { key: "signup_started", label: "Signup started", events: ["signup_started"] },
  { key: "account_created", label: "Account created", events: ["signup_completed"] },
  {
    key: "details_submitted",
    label: "Business details submitted",
    events: ["business_details_submitted"],
  },
  {
    key: "choice_completed",
    label: "Setup choice completed",
    events: ["managed_setup_selected", "self_setup_selected"],
  },
  {
    key: "onboarding_completed",
    label: "Setup request completed",
    events: ["onboarding_completed"],
  },
];

export async function getMarketingFunnel(
  range: MarketingRange,
  db?: DbLike,
): Promise<FunnelStage[]> {
  const rows = await fetchWindow(rangeStartIso(range), db);
  const visitors = new Set(rows.map((row) => row.session_id).filter(Boolean)).size;
  return FUNNEL.map((stage) => ({
    key: stage.key,
    label: stage.label,
    count:
      stage.events.length === 0
        ? visitors
        : stage.events.reduce((total, name) => total + countBy(rows, name), 0),
  }));
}

export interface SourceBreakdown {
  source: string;
  count: number;
}

export async function getTopSources(
  range: MarketingRange,
  db?: DbLike,
  limit = 8,
): Promise<SourceBreakdown[]> {
  const rows = await fetchWindow(rangeStartIso(range), db);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const source = row.source ?? "other";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface CtaBreakdown {
  location: string;
  count: number;
}

const CTA_EVENTS = ["start_free_clicked", "contact_clicked", "see_how_it_works_clicked"];

/** Clicks grouped by cta_location for the main marketing CTAs. */
export async function getTopCtaLocations(
  range: MarketingRange,
  db?: DbLike,
  limit = 10,
): Promise<CtaBreakdown[]> {
  const rows = await fetchWindow(rangeStartIso(range), db);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!CTA_EVENTS.includes(row.event_name)) continue;
    const location =
      typeof row.metadata.cta_location === "string" && row.metadata.cta_location
        ? row.metadata.cta_location
        : "unknown";
    const key = `${row.event_name} · ${location}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface FeaturedClick {
  slug: string;
  category: string;
  mode: string;
  bookNow: number;
  viewBusiness: number;
  total: number;
}

export async function getFeaturedClicks(
  range: MarketingRange,
  db?: DbLike,
): Promise<FeaturedClick[]> {
  const rows = await fetchWindow(rangeStartIso(range), db);
  const bySlug = new Map<
    string,
    { category: string; mode: string; bookNow: number; viewBusiness: number }
  >();
  for (const row of rows) {
    if (row.event_name !== "featured_business_clicked") continue;
    const slug = typeof row.metadata.business_slug === "string" ? row.metadata.business_slug : "";
    if (!slug) continue;
    const entry = bySlug.get(slug) ?? { category: "", mode: "", bookNow: 0, viewBusiness: 0 };
    if (typeof row.metadata.category === "string") entry.category = row.metadata.category;
    if (typeof row.metadata.booking_mode === "string") entry.mode = row.metadata.booking_mode;
    if (row.metadata.action === "book_now") entry.bookNow += 1;
    else entry.viewBusiness += 1;
    bySlug.set(slug, entry);
  }
  return [...bySlug.entries()]
    .map(([slug, entry]) => ({ slug, ...entry, total: entry.bookNow + entry.viewBusiness }))
    .sort((a, b) => b.total - a.total);
}

export interface SetupSplit {
  managed: number;
  self: number;
}

export async function getSetupSplit(
  range: MarketingRange,
  db?: DbLike,
): Promise<SetupSplit> {
  const rows = await fetchWindow(rangeStartIso(range), db);
  return {
    managed: countBy(rows, "managed_setup_selected"),
    self: countBy(rows, "self_setup_selected"),
  };
}

export interface DeviceBreakdown {
  device: string;
  count: number;
}

export async function getDeviceBreakdown(
  range: MarketingRange,
  db?: DbLike,
): Promise<DeviceBreakdown[]> {
  const rows = await fetchWindow(rangeStartIso(range), db);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const device = row.device ?? "other";
    counts.set(device, (counts.get(device) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Server-side marketing event recording (signup/onboarding funnel steps
 * that must survive ad-blockers). Sanitized like the client path, never
 * throws. `sessionId` links the event to the anonymous browser session
 * when the caller passes it through; otherwise a random id is used.
 */
export async function recordServerMarketingEvent(input: {
  eventName: string;
  sessionId?: string;
  pathname?: string;
  metadata?: Record<string, unknown>;
  db?: DbLike;
}): Promise<void> {
  try {
    const { error } = await serviceDb(input.db).from("marketing_events").insert({
      event_name: input.eventName,
      session_id:
        typeof input.sessionId === "string" && input.sessionId
          ? input.sessionId.slice(0, 64)
          : `srv-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      pathname:
        typeof input.pathname === "string" ? input.pathname.slice(0, 200) : null,
      metadata: sanitizeMarketingProps(input.metadata),
    });
    if (error) {
      console.error("[marketing] failed to record server event:", error.message);
    }
  } catch (err) {
    console.error("[marketing] unexpected error recording server event:", err);
  }
}
