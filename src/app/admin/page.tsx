import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import { getOperationsSummary, getRecentFailures } from "@/lib/server/operations";
import {
  getAllBusinessIntegrationHealth,
  relativeTime,
} from "@/lib/server/integrations/health";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kivo Admin",
  description: "Platform operator overview.",
  robots: { index: false, follow: false },
};

/** Called once in the data layer — not inside a React render function. */
function captureNowMs(): number {
  return Date.now();
}

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const db = getSupabase();

  const [businesses, summary, failures, integrations] = await Promise.all([
    db.from("businesses").select("id, is_demo, is_active"),
    getOperationsSummary(db),
    getRecentFailures(db),
    getAllBusinessIntegrationHealth(db),
  ]);

  const nowMs = captureNowMs();

  const bizRows = (businesses.data ?? []) as Array<{
    id: string;
    is_demo: boolean;
    is_active: boolean;
  }>;
  const totalBusinesses = bizRows.length;
  const activeReal = bizRows.filter((b) => b.is_active && !b.is_demo).length;
  const inactive = bizRows.filter((b) => !b.is_active && !b.is_demo).length;
  const demo = bizRows.filter((b) => b.is_demo).length;

  const needsAttentionCount = integrations.filter(
    (b) =>
      !b.isDemo &&
      (b.calendar.status === "needs_attention" ||
        b.messaging.status === "needs_attention" ||
        b.scheduler.status === "needs_attention"),
  ).length;

  const schedulerHealth = integrations[0]?.scheduler ?? null;

  // Pre-format relative timestamps — plain strings, never called inside render.
  const schedulerLastRunLabel = schedulerHealth?.lastRunAt
    ? relativeTime(schedulerHealth.lastRunAt, nowMs)
    : "No runs recorded";

  const recentFailures = failures.slice(0, 5).map((f) => ({
    ...f,
    ageLabel: relativeTime(f.timestamp, nowMs),
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-ink-soft">Platform health at a glance.</p>
        </div>
        <Link
          href="/admin/create-business"
          className="shrink-0 rounded-full bg-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-strong"
        >
          Create Business Profile
        </Link>
      </div>

      {/* Business counts */}
      <section aria-label="Business summary">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">
          Businesses
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {[
            { label: "Total", value: totalBusinesses },
            { label: "Active (live)", value: activeReal },
            { label: "Inactive", value: inactive },
            { label: "Demo", value: demo },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex min-h-[80px] flex-col justify-center rounded-2xl border border-line bg-card px-4 py-3"
            >
              <span className="text-2xl font-semibold tabular-nums">{stat.value}</span>
              <span className="mt-0.5 text-xs text-ink-soft">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Integration health */}
      <section aria-label="Integration health">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">
          Integrations
        </h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
          <div className="rounded-2xl border border-line bg-card px-4 py-3">
            <p className="text-xs text-ink-soft">Businesses needing attention</p>
            <p
              className={[
                "mt-1 text-2xl font-semibold tabular-nums",
                needsAttentionCount > 0 ? "text-amber-600" : "text-emerald-600",
              ].join(" ")}
            >
              {needsAttentionCount}
            </p>
            <Link href="/admin/integrations" className="mt-1 text-xs text-blue-strong hover:underline">
              View all →
            </Link>
          </div>
          <div className="rounded-2xl border border-line bg-card px-4 py-3">
            <p className="text-xs text-ink-soft">Reminder scheduler</p>
            {schedulerHealth ? (
              <>
                <p
                  className={[
                    "mt-1 text-sm font-semibold",
                    schedulerHealth.status === "healthy" ? "text-emerald-600" : "text-amber-600",
                  ].join(" ")}
                >
                  {schedulerHealth.status === "healthy" ? "Healthy" : "Needs attention"}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Last run: {schedulerLastRunLabel}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">No data yet</p>
            )}
          </div>
        </div>
      </section>

      {/* Operations snapshot */}
      <section aria-label="Operations snapshot">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">
          Last 24 hours
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {[
            { label: "Bookings created", value: summary.bookingsCreated, alert: false },
            { label: "Notifications sent", value: summary.notificationsSent, alert: false },
            {
              label: "Notification failures",
              value: summary.notificationsFailed,
              alert: summary.notificationsFailed > 0,
            },
            {
              label: "Technical failures",
              value: summary.technicalFailures,
              alert: summary.technicalFailures > 0,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={[
                "flex min-h-[80px] flex-col justify-center rounded-2xl border bg-card px-4 py-3",
                stat.alert ? "border-amber-200" : "border-line",
              ].join(" ")}
            >
              <span
                className={[
                  "text-2xl font-semibold tabular-nums",
                  stat.alert ? "text-amber-600" : "",
                ].join(" ")}
              >
                {stat.value}
              </span>
              <span className="mt-0.5 text-xs text-ink-soft">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent failures */}
      <section aria-label="Recent failures">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            Recent failures
          </h2>
          <Link href="/admin/operations" className="text-xs text-blue-strong hover:underline">
            View all →
          </Link>
        </div>
        {recentFailures.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No recent failures.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recentFailures.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-line bg-card px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{f.eventName}</span>
                  {f.errorCode && (
                    <span className="ml-2 text-ink-soft">· {f.errorCode}</span>
                  )}
                  {f.businessName && (
                    <span className="ml-2 text-ink-soft">· {f.businessName}</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-ink-soft">{f.ageLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
