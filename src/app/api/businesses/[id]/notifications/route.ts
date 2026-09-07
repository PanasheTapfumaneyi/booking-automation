import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { parseNotificationPhone } from "@/lib/server/businesses";
import {
  fetchBusinessNotificationSettings,
  upsertBusinessNotificationSettings,
} from "@/lib/server/notifications/records";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/businesses/[id]/notifications — owner notification settings. */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const settings = await fetchBusinessNotificationSettings(ctx.business.id, getSupabase());
    return NextResponse.json({
      settings: {
        business_notification_phone: settings.business_notification_phone,
        customer_notifications_enabled: settings.customer_notifications_enabled,
        business_notifications_enabled: settings.business_notifications_enabled,
        whatsapp_enabled: settings.whatsapp_enabled,
      },
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/**
 * PATCH /api/businesses/[id]/notifications — partial update.
 * Phone numbers that cannot be used for WhatsApp are rejected.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
      business_notification_phone?: unknown;
      customer_notifications_enabled?: unknown;
      business_notifications_enabled?: unknown;
      whatsapp_enabled?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const phone =
      body.business_notification_phone === undefined
        ? undefined
        : parseNotificationPhone(body.business_notification_phone);
    const flag = (value: unknown): boolean | undefined =>
      typeof value === "boolean" ? value : undefined;
    await upsertBusinessNotificationSettings(
      ctx.business.id,
      {
        businessNotificationPhone: phone,
        customerNotificationsEnabled: flag(body.customer_notifications_enabled),
        businessNotificationsEnabled: flag(body.business_notifications_enabled),
        whatsappEnabled: flag(body.whatsapp_enabled),
      },
      getSupabase(),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
