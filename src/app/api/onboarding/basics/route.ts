import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import {
  createBusinessWithOwner,
  validateBookingMode,
  validateBusinessProfile,
} from "@/lib/server/businesses";
import {
  ensureSetupRequest,
  trackSetupEvent,
  updateSetupRequest,
} from "@/lib/server/onboarding";
import { recordServerMarketingEvent } from "@/lib/server/marketing-analytics";
import { fetchBusiness } from "@/lib/server/database";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * POST /api/onboarding/basics
 *
 * Minimal business creation for the new signup flow: name, type, contact,
 * booking mode. The business is created INACTIVE (is_active = false) —
 * Kivo activates it once setup is finalized — plus an owner membership
 * and a `new` setup-request row.
 *
 * Idempotent: an authenticated user who already owns a business gets
 * their existing business back (refresh/retry never creates duplicates).
 */
export async function POST(request: Request) {
  try {
    const user = await getRequestUser().catch(() => null);
    if (!user) redirect("/login?next=/onboarding");
    const db = getSupabase();

    const memberships = await getMyMemberships(user.id).catch(() => []);
    if (memberships.length > 0) {
      const businessId = memberships[0].business_id as string;
      const business = await fetchBusiness(businessId, db).catch(() => null);
      if (business) {
        const existing = await ensureSetupRequest(business.id, user.id, db);
        return NextResponse.json({
          business: { id: business.id, slug: business.slug },
          setupStatus: existing.status,
          existing: true,
        });
      }
    }

    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      businessType?: unknown;
      phone?: unknown;
      timezone?: unknown;
      booking_mode?: unknown;
      sessionId?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }

    const profile = validateBusinessProfile({
      name: typeof body.name === "string" ? body.name : "",
      phone: typeof body.phone === "string" ? body.phone : null,
      timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    });
    const bookingMode = validateBookingMode(
      typeof body.booking_mode === "string" ? body.booking_mode : "",
    );
    const rawType = typeof body.businessType === "string" ? body.businessType.trim() : "";
    const businessType = rawType.length > 0 ? rawType.slice(0, 80) : null;

    const created = await createBusinessWithOwner(
      user.id,
      {
        name: profile.name,
        phone: profile.phone,
        timezone: profile.timezone,
        booking_mode: bookingMode,
        is_active: false,
      },
      db,
    );
    const setup = await ensureSetupRequest(created.id, user.id, db);
    if (businessType) {
      await updateSetupRequest(created.id, { businessType }, db);
    }

    trackSetupEvent("onboarding.basics_completed", created.id, {
      bookingMode,
      ...(businessType ? { businessType } : {}),
    });

    // Marketing funnel (server-recorded: survives ad-blockers). Only on
    // fresh creation — the existing-business short-circuit above is a
    // refresh/retry, not a new submission.
    void recordServerMarketingEvent({
      eventName: "business_details_submitted",
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      pathname: "/onboarding",
      metadata: { booking_mode: bookingMode },
    });

    return NextResponse.json(
      { business: created, setupStatus: setup.status, existing: false },
      { status: 201 },
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
