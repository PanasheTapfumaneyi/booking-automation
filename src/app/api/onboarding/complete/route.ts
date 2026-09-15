import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { getRequestUser, findMembership } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import {
  getSetupRequest,
  notifyOperatorOfSetupRequest,
  trackSetupEvent,
  updateSetupRequest,
} from "@/lib/server/onboarding";
import { recordServerMarketingEvent } from "@/lib/server/marketing-analytics";
import { fetchBusiness } from "@/lib/server/database";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * POST /api/onboarding/complete
 *
 * Marks self-configuration finished: self_configuring → ready_for_review.
 * The temporary page + dashboard stay available; Kivo reviews before the
 * business goes live. Runs at most once per setup (status gate) so
 * refresh/retry never duplicates completion or operator alerts.
 */
export async function POST(request: Request) {
  try {
    const user = await getRequestUser().catch(() => null);
    if (!user) redirect("/login?next=/onboarding");
    const db = getSupabase();

    const body = (await request.json().catch(() => null)) as {
      businessId?: unknown;
      sessionId?: unknown;
    } | null;
    if (!body || typeof body.businessId !== "string" || !body.businessId) {
      return NextResponse.json({ error: "Missing business." }, { status: 400 });
    }

    const membership = await findMembership(user.id, body.businessId, db);
    if (!membership) {
      return NextResponse.json(
        { error: "You don't have access to this business." },
        { status: 403 },
      );
    }

    const current = await getSetupRequest(body.businessId, db);
    if (!current) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }
    if (current.status === "ready_for_review" || current.status === "live") {
      return NextResponse.json({ setupStatus: current.status });
    }
    if (current.status !== "self_configuring") {
      return NextResponse.json(
        { error: "Finish choosing your setup path first." },
        { status: 400 },
      );
    }

    const updated = await updateSetupRequest(
      body.businessId,
      { status: "ready_for_review" },
      db,
    );
    trackSetupEvent("self_config_completed", body.businessId, {});

    // Marketing funnel (server-recorded): the self path completes here.
    // Only on the actual transition — re-completion returns early above.
    void recordServerMarketingEvent({
      eventName: "onboarding_completed",
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      pathname: "/onboarding",
      metadata: { setup_preference: "self" },
    });

    const business = await fetchBusiness(body.businessId, db).catch(() => null);
    const operatorNotified = await notifyOperatorOfSetupRequest({
      businessId: body.businessId,
      businessName: business?.name ?? "A business",
      businessType: updated.business_type,
      preference: "self",
      contactPhone: updated.contact_phone,
    });

    return NextResponse.json({
      setupStatus: updated.status,
      operatorNotified,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
