import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { fetchBusinessBySlug } from "@/lib/server/database";
import { toApiErrorResponse } from "@/lib/server/route-helper";

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
    const [services, resources, sessions] = await Promise.all([
      db
        .from("services")
        .select("id, name, duration_minutes, price")
        .eq("business_id", business.id)
        .eq("active", true),
      db
        .from("resources")
        .select("id, name, resource_type")
        .eq("business_id", business.id)
        .eq("active", true),
      db
        .from("booking_sessions")
        .select("id, service_id, start_time, end_time, capacity, service:services(name)")
        .eq("business_id", business.id)
        .eq("active", true),
    ]);
    if (services.error || resources.error || sessions.error) {
      throw services.error ?? resources.error ?? sessions.error;
    }
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
        durationMinutes: (s as Record<string, unknown>).duration_minutes,
        price: Number((s as Record<string, unknown>).price ?? 0),
        active: true,
      })),
      resources: resources.data ?? [],
      sessions: sessions.data ?? [],
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
