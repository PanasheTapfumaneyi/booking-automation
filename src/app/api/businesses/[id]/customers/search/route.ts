import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import { searchBusinessCustomers } from "@/lib/server/business-bookings";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/businesses/[id]/customers/search?q=
 *
 * Business-scoped customer lookup for the manual booking flow (id, name,
 * phone, email only — capped, no CRM features).
 */
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const customers = await searchBusinessCustomers(ctx.business.id, q, getSupabase());
    return NextResponse.json({ customers });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
