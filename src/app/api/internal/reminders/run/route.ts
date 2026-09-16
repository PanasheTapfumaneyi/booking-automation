import { NextResponse } from "next/server";
import { runDueReminders } from "@/lib/server/notifications/reminders";
import { notificationProvider } from "@/lib/server/notifications/config";
import { toApiErrorResponse } from "@/lib/server/route-helper";
import { recordEvent } from "@/lib/server/operations/events";

function cronSecret(): string | null {
  // Support both custom REMINDER_CRON_SECRET and Vercel's built-in CRON_SECRET.
  const raw = (process.env.REMINDER_CRON_SECRET ?? process.env.CRON_SECRET ?? "").trim();
  return raw.length > 0 ? raw : null;
}

/**
 * POST /api/internal/reminders/run
 *
 * Scheduler entry point for Phase 5 timed reminders. Protected by the
 * server-side REMINDER_CRON_SECRET via `Authorization: Bearer <secret>`
 * (never exposed to the browser). Safe to call repeatedly and concurrently
 * — claiming is database-backed, so overlapping runs cannot duplicate sends.
 *
 * Returns operational counts only — no phones, tokens, or message bodies.
 *
 * Operations events recorded:
 *   reminder_scheduler_run  — one per call, carries the full summary.
 *   reminder_sent / reminder_failed / reminder_skipped — one per booking
 *     (emitted inside runDueReminders via recordReminderEvent).
 */
export async function POST(request: Request) {
  try {
    const secret = cronSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "Reminder runner is not configured." },
        { status: 503 },
      );
    }
    const header = request.headers.get("authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!presented || presented !== secret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (notificationProvider() === "none") {
      return NextResponse.json(
        { error: "Notifications are disabled." },
        { status: 503 },
      );
    }

    const runAt = new Date().toISOString();
    const summary = await runDueReminders();

    // Record a scheduler-level run event so operators can verify the cron is
    // firing, see eligibility counts, and spot sustained failure patterns.
    void recordEvent({
      eventName: "reminder_scheduler_run",
      category: "reminder",
      attemptId: `sched_${Date.now()}`,
      metadata: {
        runAt,
        processed: summary.processed,
        sent: summary.sent,
        skipped: summary.skipped,
        failed: summary.failed,
      },
    });

    return NextResponse.json(summary);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
