import { NextResponse } from "next/server";
import { baileysApiKey, baileysBaseUrl } from "@/lib/server/notifications/config";
import { toApiErrorResponse } from "@/lib/server/route-helper";

/**
 * GET /api/integrations/baileys/status
 *
 * Kivo-side view of the standalone Baileys service. Calls the service's
 * own /status endpoint and returns a safe representation — never an API
 * key, QR data, or session material.
 */
export async function GET() {
  try {
    if (baileysApiKey() === null) {
      return NextResponse.json({
        provider: "baileys",
        configured: false,
        reachable: null,
        sessionReady: null,
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3_000);
    let res: Response;
    try {
      res = await fetch(`${baileysBaseUrl()}/status`, { signal: controller.signal });
    } catch {
      clearTimeout(timer);
      return NextResponse.json({
        provider: "baileys",
        configured: true,
        reachable: false,
        sessionReady: null,
      });
    }
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json({
        provider: "baileys",
        configured: true,
        reachable: false,
        sessionReady: null,
      });
    }

    const body = (await res.json()) as { connected?: unknown };
    return NextResponse.json({
      provider: "baileys",
      configured: true,
      reachable: true,
      sessionReady: body.connected === true,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
