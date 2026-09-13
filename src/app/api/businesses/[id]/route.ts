import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import {
  getBusinessSettings,
  updateBusinessProfile,
  listServices,
  listResources,
  listSessions,
} from "@/lib/server/businesses";
import { fetchBusinessNotificationSettings } from "@/lib/server/notifications/records";
import { getConnectionStatus } from "@/lib/server/google-calendar/connections";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Safe offering lists for the settings UI — no customer or booking data. */
async function offeringBundle(businessId: string, db: SupabaseClient) {
  const [services, resources, sessions, notifications] = await Promise.all([
    listServices(businessId, db),
    listResources(businessId, db),
    listSessions(businessId, db),
    fetchBusinessNotificationSettings(businessId, db),
  ]);
  return {
    services,
    resources,
    sessions,
    notifications: {
      business_notification_phone: notifications.business_notification_phone,
      customer_notifications_enabled: notifications.customer_notifications_enabled,
      business_notifications_enabled: notifications.business_notifications_enabled,
      whatsapp_enabled: notifications.whatsapp_enabled,
    },
  };
}

/**
 * GET /api/businesses/[id] — full settings bundle for the owner UI.
 * Includes the Google connection state (safe flags only, via the existing
 * status helper). booking_mode is read-only after creation.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const db = getSupabase();
    const settings = await getBusinessSettings(ctx.business.id, db);
    const offering = await offeringBundle(ctx.business.id, db);
    const calendar = await getConnectionStatus(ctx.business.id).catch(() => ({
      connected: false,
      calendarId: null,
      accountEmail: null,
      requiresReconnect: false,
      checked: false,
    }));
    return NextResponse.json({ ...settings, ...offering, calendar });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/**
 * PATCH /api/businesses/[id] — profile + hours.
 * Body: `{ name?, phone?, timezone?, availability? }`.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      phone?: unknown;
      timezone?: unknown;
      availability?: unknown;
      tagline?: unknown;
      description?: unknown;
      cover_image_url?: unknown;
      logo_url?: unknown;
      address?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      is_active?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    await updateBusinessProfile(
      ctx.business.id,
      {
        name: typeof body.name === "string" ? body.name : ctx.business.name,
        phone: typeof body.phone === "string" ? body.phone : ctx.business.phone,
        timezone:
          typeof body.timezone === "string" ? body.timezone : ctx.business.timezone,
        availability: body.availability,
        tagline: body.tagline,
        description: body.description,
        cover_image_url: body.cover_image_url,
        logo_url: body.logo_url,
        address: body.address,
        latitude: body.latitude,
        longitude: body.longitude,
        is_active: body.is_active,
      },
      getSupabase(),
    );
    const settings = await getBusinessSettings(ctx.business.id, getSupabase());
    return NextResponse.json(settings);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
