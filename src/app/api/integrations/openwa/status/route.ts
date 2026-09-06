import { NextResponse } from "next/server";
import { checkNotificationHealth } from "@/lib/server/notifications/service";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * GET /api/integrations/openwa/status
 *
 * Internal dev status for the notification provider. Response never contains
 * credentials — only configured/reachable/sessionReady flags.
 */
export async function GET() {
  try {
    const status = await checkNotificationHealth();
    return NextResponse.json(status);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}