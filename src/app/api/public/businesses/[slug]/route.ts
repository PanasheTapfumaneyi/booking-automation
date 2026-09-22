import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { getMyBusinessIds } from "@/lib/server/auth";
import { fetchBusinessBySlug } from "@/lib/server/database";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { fetchSessionBookedQuantity } from "@/lib/server/strategies/capacity";

/**
 * GET /api/public/businesses/[slug]
 *
 * Public booking catalog for one business: only the minimum data the
 * customer flow needs (profile basics, active offering, hours). Never
 * settings, tokens, credentials, or inactive items.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const db = getSupabase();
    const business = await fetchBusinessBySlug(slug, db);
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }
    // Inactive businesses stay hidden — except to their own members, who
    // need the catalog to test the booking flow before go-live.
    if (business.is_active === false) {
      const memberIds: string[] = await getMyBusinessIds().catch(() => []);
      if (!memberIds.includes(business.id)) {
        return NextResponse.json({ error: "Business not found." }, { status: 404 });
      }
    }
    const [services, resources, sessions] = await Promise.all([
      db
        .from("services")
        .select("id, name, description, duration_minutes, price, image_url")
        .eq("business_id", business.id)
        .eq("active", true),
      db
        .from("resources")
        .select("id, name, description, resource_type, image_url, metadata")
        .eq("business_id", business.id)
        .eq("active", true),
      // Plain columns only: no `service:services(name)` embed, so the
      // catalog never depends on the PostgREST FK/relationship cache. The
      // service name is joined in JS from the services already fetched
      // above (same rows, same request, no extra round-trip).
      db
        .from("booking_sessions")
        .select("id, service_id, start_time, end_time, capacity, active")
        .eq("business_id", business.id)
        .eq("active", true),
    ]);
    if (services.error || resources.error || sessions.error) {
      throw services.error ?? resources.error ?? sessions.error;
    }
    const serviceNames = new Map(
      ((services.data ?? []) as Array<Record<string, unknown>>).map((s) => [
        s.id as string,
        s.name as string,
      ]),
    );

    // Compute booked counts for capacity sessions (only for future sessions)
    const now = new Date().toISOString();
    const sessionsWithBooked = await Promise.all(
      (sessions.data ?? []).map(async (s) => {
        const row = s as Record<string, unknown>;
        const sessionId = row.id as string;
        const startTime = row.start_time as string;
        // Only compute booked for future sessions
        const isFuture = startTime >= now;
        const booked = isFuture
          ? await fetchSessionBookedQuantity({ sessionId })
          : 0;
        const capacity = row.capacity as number;
        return {
          id: sessionId,
          service_id: row.service_id as string,
          start_time: startTime,
          end_time: (row.end_time as string | null) ?? null,
          capacity,
          booked,
          remaining: Math.max(0, capacity - booked),
          active: row.active as boolean,
          service_name: serviceNames.get(row.service_id as string) ?? null,
        };
      }),
    );

    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        phone: business.phone,
        timezone: business.timezone,
        booking_mode: business.booking_mode,
        slug: business.slug,
        hours: business.availability ?? null,
      },
      services: (services.data ?? []).map((s) => ({
        id: (s as Record<string, unknown>).id,
        businessId: business.id,
        name: (s as Record<string, unknown>).name,
        description: ((s as Record<string, unknown>).description as string | null) ?? "",
        durationMinutes: (s as Record<string, unknown>).duration_minutes,
        price: Number((s as Record<string, unknown>).price ?? 0),
        image_url: ((s as Record<string, unknown>).image_url as string | null) ?? null,
        active: true,
      })),
      resources: (resources.data ?? []).map((r) => ({
        ...(r as Record<string, unknown>),
        description: ((r as Record<string, unknown>).description as string | null) ?? null,
      })),
      sessions: sessionsWithBooked,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
