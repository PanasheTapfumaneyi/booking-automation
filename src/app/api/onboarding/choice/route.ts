import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { getRequestUser, findMembership } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { parseNotificationPhone } from "@/lib/server/businesses";
import { fetchBusiness } from "@/lib/server/database";
import {
  ensureSetupRequest,
  notifyOperatorOfSetupRequest,
  setBusinessPhone,
  trackSetupEvent,
  updateSetupRequest,
  type SetupPreference,
} from "@/lib/server/onboarding";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * POST /api/onboarding/choice
 *
 * Records the owner's setup choice: "managed" (Kivo sets it up →
 * pending_setup) or "self" (owner configures now → self_configuring).
 * Confirms the WhatsApp contact number (pre-filled from the business).
 *
 * Idempotent: repeating the same choice rewrites the same row and only
 * notifies the operator on the FIRST choice (or a changed choice) —
 * refresh/retry never duplicates the lead or the alert.
 */
export async function POST(request: Request) {
  try {
    const user = await getRequestUser().catch(() => null);
    if (!user) redirect("/login?next=/onboarding");
    const db = getSupabase();

    const body = (await request.json().catch(() => null)) as {
      businessId?: unknown;
      preference?: unknown;
      contactPhone?: unknown;
      businessType?: unknown;
    } | null;
    if (!body || typeof body.businessId !== "string" || !body.businessId) {
      return NextResponse.json({ error: "Missing business." }, { status: 400 });
    }
    if (body.preference !== "managed" && body.preference !== "self") {
      return NextResponse.json(
        { error: "Please choose how you'd like to set up Kivo." },
        { status: 400 },
      );
    }
    const preference = body.preference as SetupPreference;

    const membership = await findMembership(user.id, body.businessId, db);
    if (!membership) {
      return NextResponse.json(
        { error: "You don't have access to this business." },
        { status: 403 },
      );
    }
    const business = await fetchBusiness(body.businessId, db).catch(() => null);
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    // Contact number: explicit entry wins, otherwise the business phone.
    // Managed setup needs a reachable number — Kivo contacts them there.
    const rawContact =
      typeof body.contactPhone === "string" && body.contactPhone.trim().length > 0
        ? body.contactPhone.trim()
        : (business.phone ?? "");
    const contactPhone =
      rawContact.length > 0 ? parseNotificationPhone(rawContact) : null;
    if (preference === "managed" && !contactPhone) {
      return NextResponse.json(
        { error: "Please add a WhatsApp number so Kivo can contact you about the setup." },
        { status: 400 },
      );
    }
    const rawType = typeof body.businessType === "string" ? body.businessType.trim() : "";
    const businessType = rawType.length > 0 ? rawType.slice(0, 80) : null;

    const previous = await ensureSetupRequest(business.id, user.id, db);
    const firstChoice = previous.preference === null;

    if (contactPhone && contactPhone !== (business.phone ?? "")) {
      await setBusinessPhone(business.id, contactPhone, db);
    }

    const updated = await updateSetupRequest(
      business.id,
      {
        preference,
        status: preference === "managed" ? "pending_setup" : "self_configuring",
        contactPhone,
        ...(businessType ? { businessType } : {}),
      },
      db,
    );

    trackSetupEvent("setup_choice_made", business.id, { preference });

    // Operator alert only on first choice or a changed choice.
    let operatorNotified = false;
    if (firstChoice || previous.preference !== preference) {
      operatorNotified = await notifyOperatorOfSetupRequest({
        businessId: business.id,
        businessName: business.name,
        businessType: updated.business_type,
        preference,
        contactPhone,
      });
      trackSetupEvent("setup_choice_made", business.id, {
        preference,
        operatorNotified,
      });
    }

    return NextResponse.json({
      setupStatus: updated.status,
      preference: updated.preference,
      operatorNotified,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
