import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import {
  listBusinessBookings,
  searchBusinessCustomers,
  getBusinessDayBounds,
  type BookingListFilters,
} from "@/lib/server/business-bookings";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import type { Booking } from "@/types/booking";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const LIVE_STATUSES: Booking["status"][] = ["confirmed", "rescheduled"];

/**
 * GET /api/businesses/[id]/bookings
 * Query: view=today|upcoming|past|cancelled|all, status, serviceId,
 * resourceId, sessionId, search, from, to, limit, offset. Day bounds use
 * the business timezone.
 */
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const searchParams = new URL(request.url).searchParams;
    const db = getSupabase();

    const view = searchParams.get("view") ?? "upcoming";
    const now = new Date();
    const { dayStartUtc, dayEndUtc } = getBusinessDayBounds(ctx.business.timezone, now);
    const filters: BookingListFilters = {
      limit: parseLimit(searchParams.get("limit")),
      offset: parseOffset(searchParams.get("offset")),
    };

    const statusParam = searchParams.get("status");
    if (statusParam) {
      filters.statuses = [statusParam as Booking["status"]];
    }
    const serviceId = searchParams.get("serviceId");
    if (serviceId) filters.serviceId = serviceId;
    const resourceId = searchParams.get("resourceId");
    if (resourceId) filters.resourceId = resourceId;
    const sessionId = searchParams.get("sessionId");
    if (sessionId) filters.sessionId = sessionId;
    if (searchParams.get("from")) filters.fromIso = searchParams.get("from") as string;
    if (searchParams.get("to")) filters.toIso = searchParams.get("to") as string;

    const search = (searchParams.get("search") ?? "").trim();
    if (search.length > 0) {
      const customers = await searchBusinessCustomers(ctx.business.id, search, db);
      if (customers.length === 0) {
        return NextResponse.json({ bookings: [] });
      }
      filters.customerIds = customers.map((c) => c.id);
    }

    switch (view) {
      case "today":
        filters.statuses = filters.statuses ?? [...LIVE_STATUSES];
        filters.fromIso = filters.fromIso ?? dayStartUtc;
        filters.toIso = filters.toIso ?? dayEndUtc;
        break;
      case "upcoming":
        filters.statuses = filters.statuses ?? [...LIVE_STATUSES];
        filters.fromIso = filters.fromIso ?? dayEndUtc;
        break;
      case "past":
        filters.toIso = filters.toIso ?? now.toISOString();
        filters.order = "desc";
        break;
      case "cancelled":
        filters.statuses = filters.statuses ?? ["cancelled"];
        filters.order = "desc";
        break;
      default:
        break;
    }

    const bookings = await listBusinessBookings(ctx.business.id, filters, db);
    return NextResponse.json({ bookings });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseOffset(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
