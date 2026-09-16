import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import {
  getAllBusinessIntegrationHealth,
  getIntegrationHealth,
  relativeTime,
  type BusinessIntegrationSummary,
  type HealthStatus,
} from "@/lib/server/integrations/health";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Integrations — Kivo Admin",
  description: "Cross-business integration health.",
  robots: { index: false, follow: false },
};

interface IntegrationsAdminPageProps {
  searchParams: Promise<{ business?: string }>;
}

// ---------------------------------------------------------------------------
// Pure presentation helpers (no Date.now() calls)
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: HealthStatus }) {
  const classes: Record<HealthStatus, string> = {
    healthy: "bg-emerald-500",
    needs_attention: "bg-amber-400",
    not_connected: "bg-line",
    disabled: "bg-line",
  };
  const labels: Record<HealthStatus, string> = {
    healthy: "Healthy",
    needs_attention: "Needs attention",
    not_connected: "Not connected",
    disabled: "Disabled",
  };
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className={`inline-block h-2 w-2 rounded-full ${classes[status]}`} aria-hidden="true" />
      <span className="text-ink-soft">{labels[status]}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const configs: Record<HealthStatus, { label: string; className: string }> = {
    healthy: { label: "Healthy", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    needs_attention: { label: "Needs attention", className: "bg-amber-50 text-amber-700 border-amber-200" },
    not_connected: { label: "Not connected", className: "bg-ink/5 text-ink-soft border-line" },
    disabled: { label: "Disabled", className: "bg-ink/5 text-ink-soft border-line" },
  };
  const { label, className } = configs[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className={muted ? "text-ink-soft" : "font-medium text-ink"}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drill-down: single business
// ---------------------------------------------------------------------------

/** Called once in the data layer — not inside a React render function. */
function captureNowMs(): number {
  return Date.now();
}

async function BusinessDrillDown({
  businessId,
  businesses,
}: {
  businessId: string;
  businesses: BusinessIntegrationSummary[];
}) {
  const db = getSupabase();
  const biz = businesses.find((b) => b.businessId === businessId);
  if (!biz) return null;

  const health = await getIntegrationHealth(businessId, db);
  const { calendar, messaging, scheduler } = health;

  // Pre-format relative time strings here, in the async data layer.
  const nowMs = captureNowMs();
  const calLastFailure = calendar.lastFailureAt
    ? relativeTime(calendar.lastFailureAt, nowMs)
    : null;
  const msgLastSuccess = messaging.lastSuccessAt
    ? relativeTime(messaging.lastSuccessAt, nowMs)
    : null;
  const msgLastFailure = messaging.lastFailureAt
    ? relativeTime(messaging.lastFailureAt, nowMs)
    : null;
  const msgFailures = messaging.recentFailures.map((f) => ({
    ...f,
    ageLabel: relativeTime(f.at, nowMs),
  }));
  const schedulerLastRun = scheduler.lastRunAt
    ? relativeTime(scheduler.lastRunAt, nowMs)
    : "No runs recorded";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{biz.businessName}</h2>
        <Link href="/admin/integrations" className="text-sm text-ink-soft hover:text-ink">
          ← All businesses
        </Link>
      </div>

      {/* Calendar */}
      <section className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">Google Calendar</p>
          <StatusBadge status={calendar.status} />
        </div>
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {calendar.accountEmail && <Row label="Account" value={calendar.accountEmail} />}
          {calendar.calendarId && (
            <Row
              label="Calendar"
              value={calendar.calendarId === "primary" ? "Primary calendar" : calendar.calendarId}
            />
          )}
          {calendar.requiresReconnect && <Row label="Requires reconnect" value="Yes" muted />}
          {calLastFailure && <Row label="Last auth failure" value={calLastFailure} muted />}
          {calendar.status === "not_connected" && (
            <p className="text-sm text-ink-soft">No active connection.</p>
          )}
        </div>
      </section>

      {/* Messaging */}
      <section className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">WhatsApp notifications</p>
          <StatusBadge status={messaging.status} />
        </div>
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <Row label="Enabled" value={messaging.enabled ? "Yes" : "No"} />
          {msgLastSuccess && <Row label="Last successful delivery" value={msgLastSuccess} />}
          {msgLastFailure && <Row label="Last failure" value={msgLastFailure} muted />}
          {messaging.recentFailureCount > 0 && (
            <Row label="Recent failures (24h)" value={String(messaging.recentFailureCount)} muted />
          )}
        </div>
        {msgFailures.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-soft">
              Recent failure detail
            </p>
            <ul className="space-y-1.5">
              {msgFailures.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-4 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm"
                >
                  <span>
                    <span className="font-medium text-amber-800">{f.type}</span>
                    <span className="mx-1 text-amber-600">—</span>
                    <span className="text-amber-700">{f.reason}</span>
                  </span>
                  <span className="shrink-0 text-xs text-amber-500">{f.ageLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {msgFailures.length === 0 && messaging.status !== "disabled" && (
          <p className="mt-4 border-t border-line pt-4 text-sm text-emerald-700">
            No recent notification issues.
          </p>
        )}
      </section>

      {/* Scheduler */}
      <section className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">Reminder scheduler</p>
          <StatusBadge status={scheduler.status} />
        </div>
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <Row label="Last run" value={schedulerLastRun} />
          {scheduler.lastRunProcessed !== null && (
            <Row label="Reminders processed" value={String(scheduler.lastRunProcessed)} muted />
          )}
          {scheduler.status === "needs_attention" && (
            <p className="mt-2 text-sm text-amber-700">
              No scheduler run in the last 15 minutes. Verify Supabase Cron is configured and the
              endpoint is reachable.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview: all businesses
// ---------------------------------------------------------------------------

export default async function AdminIntegrationsPage({
  searchParams,
}: IntegrationsAdminPageProps) {
  await requirePlatformAdmin();
  const db = getSupabase();
  const params = await searchParams;
  const focusedBusinessId = params.business?.trim() || null;

  const businesses = await getAllBusinessIntegrationHealth(db);

  if (focusedBusinessId) {
    return <BusinessDrillDown businessId={focusedBusinessId} businesses={businesses} />;
  }

  // Pre-format scheduler status string in data layer.
  const nowMs = captureNowMs();
  const schedulerStatus = businesses[0]?.scheduler ?? null;
  const schedulerLastRunLabel = schedulerStatus?.lastRunAt
    ? relativeTime(schedulerStatus.lastRunAt, nowMs)
    : "No runs recorded";

  const needsAttention = businesses.filter(
    (b) =>
      !b.isDemo &&
      (b.calendar.status === "needs_attention" ||
        b.messaging.status === "needs_attention" ||
        b.scheduler.status === "needs_attention"),
  );
  const healthy = businesses.filter(
    (b) =>
      !b.isDemo &&
      b.calendar.status !== "needs_attention" &&
      b.messaging.status !== "needs_attention" &&
      b.scheduler.status !== "needs_attention",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Cross-business integration health for{" "}
          {businesses.filter((b) => !b.isDemo).length} live businesses.
        </p>
      </div>

      {/* Scheduler banner */}
      {schedulerStatus && (
        <div
          className={[
            "flex items-center justify-between gap-4 rounded-2xl border px-5 py-3",
            schedulerStatus.status === "healthy"
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50",
          ].join(" ")}
        >
          <div>
            <span
              className={[
                "font-semibold",
                schedulerStatus.status === "healthy" ? "text-emerald-800" : "text-amber-800",
              ].join(" ")}
            >
              Reminder scheduler —{" "}
              {schedulerStatus.status === "healthy" ? "Healthy" : "Needs attention"}
            </span>
            <p
              className={[
                "mt-0.5 text-sm",
                schedulerStatus.status === "healthy" ? "text-emerald-700" : "text-amber-700",
              ].join(" ")}
            >
              Last run: {schedulerLastRunLabel}
              {schedulerStatus.status === "needs_attention" &&
                " — Verify Supabase Cron is configured."}
            </p>
          </div>
        </div>
      )}

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <section aria-label="Businesses needing attention">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-600">
            Needs attention ({needsAttention.length})
          </h2>
          <ul className="space-y-2">
            {needsAttention.map((biz) => (
              <li
                key={biz.businessId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-amber-900">{biz.businessName}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <StatusDot status={biz.calendar.status} />
                    <StatusDot status={biz.messaging.status} />
                    {biz.messaging.recentFailureCount > 0 && (
                      <span className="text-xs text-amber-600">
                        {biz.messaging.recentFailureCount} notification{" "}
                        {biz.messaging.recentFailureCount === 1 ? "failure" : "failures"}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/admin/integrations?business=${biz.businessId}`}
                  className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  View details →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* All businesses table */}
      <section aria-label="All businesses">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">
          All businesses
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Business
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Calendar
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Messaging
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Reminders
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {businesses.map((biz, i) => (
                <tr
                  key={biz.businessId}
                  className={i < businesses.length - 1 ? "border-b border-line" : ""}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">{biz.businessName}</span>
                    {biz.isDemo && <span className="ml-2 text-xs text-ink-soft">Demo</span>}
                    {!biz.isActive && !biz.isDemo && (
                      <span className="ml-2 text-xs text-ink-soft">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot status={biz.calendar.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot status={biz.messaging.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot status={biz.scheduler.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/integrations?business=${biz.businessId}`}
                      className="text-xs text-blue-strong hover:underline"
                    >
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {needsAttention.length === 0 && healthy.length > 0 && (
        <p className="text-sm text-emerald-700">All live businesses are healthy.</p>
      )}
    </div>
  );
}
