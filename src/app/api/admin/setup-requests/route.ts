import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/server/auth";
import {
  getSetupRequest,
  listSetupRequests,
  setBusinessActive,
  trackSetupEvent,
  updateSetupRequest,
  SETUP_STATUSES,
  type SetupStatus,
} from "@/lib/server/onboarding";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * GET /api/admin/setup-requests — platform-admin global lead list.
 * PATCH /api/admin/setup-requests — move one business through the setup
 * lifecycle. Moving to `live` activates the public page; moving anywhere
 * else deactivates it. Businesses WITHOUT a setup row (existing tenants)
 * are never touched.
 */
export async function GET() {
  try {
    await requirePlatformAdmin();
    const requests = await listSetupRequests(getSupabase());
    return NextResponse.json({ requests });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformAdmin();
    const body = (await request.json().catch(() => null)) as {
      businessId?: unknown;
      status?: unknown;
    } | null;
    if (!body || typeof body.businessId !== "string" || !body.businessId) {
      return NextResponse.json({ error: "Missing business." }, { status: 400 });
    }
    if (typeof body.status !== "string" || !SETUP_STATUSES.includes(body.status as SetupStatus)) {
      return NextResponse.json({ error: "That setup status isn't valid." }, { status: 400 });
    }
    const db = getSupabase();
    const current = await getSetupRequest(body.businessId, db);
    if (!current) {
      return NextResponse.json({ error: "No setup request for this business." }, { status: 404 });
    }
    const updated = await updateSetupRequest(
      body.businessId,
      { status: body.status as SetupStatus },
      db,
    );
    // Activation follows the lifecycle: only `live` is public.
    await setBusinessActive(body.businessId, updated.status === "live", db);
    trackSetupEvent("setup_status_changed", body.businessId, {
      from: current.status,
      to: updated.status,
    });
    return NextResponse.json({ setupStatus: updated.status });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
