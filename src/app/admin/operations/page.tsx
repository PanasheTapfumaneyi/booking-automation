import { requirePlatformAdmin } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import {
  getOperationsSummary,
  getRecentFailures,
  getBusinessHealth,
  getBookingFunnel,
} from "@/lib/server/operations/dashboard";

export const dynamic = "force-dynamic";

export default async function OperationsDashboardPage() {
  // PLATFORM-ADMIN ONLY: cross-business operational data.
  // Requires app_metadata.platform_admin = true in Supabase Auth.
  await requirePlatformAdmin();
  const db = getSupabase();

  const [summary, failures, healthArr, funnel] = await Promise.all([
    getOperationsSummary(db),
    getRecentFailures(db),
    getBusinessHealth(db),
    getBookingFunnel(db),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Booking funnel and system health · last 24 hours.
        </p>
      </div>

      {/* Summary Cards */}
      <section aria-label="Summary">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <SummaryCard
            label="Booking attempts"
            value={summary.bookingAttempts}
            sub={`${summary.submitAttempts} submits`}
          />
          <SummaryCard
            label="Bookings created"
            value={summary.bookingsCreated}
            sub={`${summary.submitSuccessRate.toFixed(1)}% success`}
          />
          <SummaryCard
            label="Failures"
            value={summary.bookingsFailed}
            sub={`${summary.technicalFailures} technical`}
            alert={summary.technicalFailures > 0}
          />
          <SummaryCard
            label="Notifications"
            value={summary.notificationsSent}
            sub={`${summary.notificationsFailed} failed`}
            alert={summary.notificationsFailed > 0}
          />
        </div>
      </section>

      {/* Funnel */}
      <section aria-label="Booking funnel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">
          Booking funnel
        </h2>
        <div className="space-y-2">
          {funnel.map((step) => (
            <div
              key={step.step}
              className="flex items-center gap-4 rounded-xl border border-line bg-card px-4 py-2.5"
            >
              <span className="w-44 text-sm text-ink-soft">{step.step}</span>
              <div className="flex-1 overflow-hidden rounded-full bg-line h-2">
                <div
                  className="h-full rounded-full bg-blue/60 transition-all"
                  style={{ width: `${step.percentage}%` }}
                />
              </div>
              <span className="w-12 text-right text-sm font-medium tabular-nums">
                {step.count}
              </span>
              <span className="w-12 text-right text-xs text-ink-soft tabular-nums">
                {step.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Business health aggregate */}
      {healthArr.length > 0 && (
        <section aria-label="Business health">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">
            Aggregate business health ({healthArr.length})
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
            <HealthStat
              label="Attempts"
              value={healthArr.reduce((s, h) => s + h.bookingAttempts, 0)}
            />
            <HealthStat
              label="Completed"
              value={healthArr.reduce((s, h) => s + h.completed, 0)}
            />
            <HealthStat
              label="Technical failures"
              value={healthArr.reduce((s, h) => s + h.technicalFailures, 0)}
              alert={healthArr.some((h) => h.technicalFailures > 0)}
            />
            <HealthStat
              label="Notification failures"
              value={healthArr.reduce((s, h) => s + h.notificationFailures, 0)}
              alert={healthArr.some((h) => h.notificationFailures > 0)}
            />
            <HealthStat
              label="Calendar failures"
              value={healthArr.reduce((s, h) => s + h.calendarFailures, 0)}
              alert={healthArr.some((h) => h.calendarFailures > 0)}
            />
          </div>
        </section>
      )}

      {/* Recent failures */}
      <section aria-label="Recent failures">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">
          Recent failures
        </h2>
        {failures.length === 0 ? (
          <p className="text-sm text-ink-soft">No recent failures.</p>
        ) : (
          <ul className="space-y-2">
            {failures.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{f.eventName}</span>
                  {f.errorCode && (
                    <span
                      className={[
                        "ml-2 inline-block rounded px-2 py-0.5 text-xs font-medium",
                        f.severity === "technical"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700",
                      ].join(" ")}
                    >
                      {f.errorCode}
                    </span>
                  )}
                  {f.businessName && (
                    <span className="ml-2 text-ink-soft">{f.businessName}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-soft">
                  {f.provider && <span>{f.provider}</span>}
                  <span>{new Date(f.timestamp).toLocaleString("en-GB")}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: number;
  sub: string;
  alert?: boolean;
}) {
  return (
    <div
      className={[
        "flex min-h-[80px] flex-col justify-center rounded-2xl border bg-card px-4 py-3",
        alert ? "border-amber-200" : "border-line",
      ].join(" ")}
    >
      <span
        className={[
          "text-2xl font-semibold tabular-nums",
          alert ? "text-amber-600" : "",
        ].join(" ")}
      >
        {value}
      </span>
      <span className="mt-0.5 text-xs text-ink-soft">{label}</span>
      <span className="text-xs text-ink-soft">{sub}</span>
    </div>
  );
}

function HealthStat({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3">
      <p
        className={[
          "text-xl font-semibold tabular-nums",
          alert ? "text-amber-600" : "",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-soft">{label}</p>
    </div>
  );
}
