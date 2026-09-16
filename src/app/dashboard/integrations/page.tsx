import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { fetchBusiness } from "@/lib/server/database";
import { getSupabase } from "@/lib/supabase/server";
import {
  getIntegrationHealth,
  relativeTime,
  type HealthStatus,
} from "@/lib/server/integrations/health";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Google Calendar and notification integration health.",
  robots: { index: false, follow: false },
};

function formatRelativeTime(timestamp: string | null, now: number): string {
  if (!timestamp) return "Not yet started";
  return relativeTime(timestamp, now);
}

function statusBadge(status: HealthStatus) {
  const configs: Record<HealthStatus, { label: string; className: string }> = {
    healthy: {
      label: "Healthy",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    needs_attention: {
      label: "Needs attention",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
    not_connected: {
      label: "Not connected",
      className: "bg-ink/5 text-ink-soft border-line",
    },
    disabled: {
      label: "Disabled",
      className: "bg-ink/5 text-ink-soft border-line",
    },
  };
  const { label, className } = configs[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className={muted ? "text-ink-soft" : "font-medium text-ink"}>
        {value}
      </span>
    </div>
  );
}

function IntegrationsContent({
  calendar,
  messaging,
  scheduler,
  businessId,
  now,
}: {
  calendar: typeof calendar;
  messaging: typeof messaging;
  scheduler: typeof scheduler;
  businessId: string;
  now: number;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Status of your connected services.
        </p>
      </div>

      <section aria-label="Google Calendar" className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Google Calendar</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Keeps your calendar in sync with bookings.
            </p>
          </div>
          {statusBadge(calendar.status)}
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {calendar.status !== "not_connected" && (
            <>
              {calendar.accountEmail && (
                <Row label="Account" value={calendar.accountEmail} />
              )}
              {calendar.calendarId && (
                <Row
                  label="Calendar"
                  value={
                    calendar.calendarId === "primary"
                      ? "Primary calendar"
                      : calendar.calendarId
                  }
                />
              )}
              {calendar.lastFailureAt && (
                <Row
                  label="Last issue"
                  value={formatRelativeTime(calendar.lastFailureAt, now)}
                  muted
                />
              )}
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {calendar.status === "not_connected" && (
            <Link
              href={`/api/integrations/google-calendar/connect?business=${businessId}`}
              className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-strong"
            >
              Connect Google Calendar
            </Link>
          )}
          {calendar.status === "needs_attention" && calendar.requiresReconnect && (
            <>
              <Link
                href={`/api/integrations/google-calendar/connect?business=${businessId}`}
                className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-strong"
              >
                Reconnect
              </Link>
              <p className="mt-1 w-full text-xs text-ink-soft">
                Calendar access needs to be re-authorized. Click Reconnect to fix this.
              </p>
            </>
          )}
          {calendar.status === "healthy" && (
            <Link
              href={`/settings?business=${businessId}`}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              Manage in settings
            </Link>
          )}
        </div>
      </section>

      <section aria-label="WhatsApp notifications" className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">WhatsApp notifications</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Sends booking confirmations, reminders and updates to customers.
            </p>
          </div>
          {statusBadge(messaging.status)}
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {messaging.status === "disabled" ? (
            <p className="text-sm text-ink-soft">Customer notifications are currently disabled.</p>
          ) : (
            <>
              {messaging.lastSuccessAt && (
                <Row
                  label="Last successful delivery"
                  value={formatRelativeTime(messaging.lastSuccessAt, now)}
                />
              )}
              {messaging.recentFailureCount > 0 && (
                <Row label="Recent failures" value={String(messaging.recentFailureCount)} muted />
              )}
            </>
          )}
        </div>

        {messaging.recentFailures.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-soft">Recent issues</p>
            <ul className="space-y-1.5">
              {messaging.recentFailures.map((f, i) => (
                <li key={i} className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm">
                  <span className="font-medium text-amber-800">{f.type}</span>
                  <span className="mx-1 text-amber-600">—</span>
                  <span className="text-amber-700">{f.reason}</span>
                  <span className="ml-2 text-xs text-amber-500">{formatRelativeTime(f.at, now)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messaging.recentFailures.length === 0 && messaging.status !== "disabled" && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm text-emerald-700">No recent notification issues.</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {messaging.status === "disabled" && (
            <Link
              href={`/settings?business=${messaging.status === "disabled" ? "businessId" : "businessId"}`}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              Enable in settings
            </Link>
          )}
          {messaging.status === "needs_attention" && (
            <p className="text-sm text-ink-soft">Kivo is checking this integration. Contact support if the issue persists.</p>
          )}
        </div>
      </section>

      <section aria-label="Booking reminders" className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Booking reminders</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Automatic 1-hour reminder sent to customers before their appointment.
            </p>
          </div>
          {statusBadge(scheduler.status)}
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <Row label="Last checked" value={formatRelativeTime(scheduler.lastRunAt, now)} />
          {scheduler.lastRunProcessed !== null && (
            <Row
              label="Reminders processed in last run"
              value={String(scheduler.lastRunProcessed)}
              muted
            />
          )}
        </div>

        {scheduler.status === "needs_attention" && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm text-ink-soft">Kivo is checking this integration. Contact support if the issue persists.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default async function IntegrationsPage({
  searchParams,
}: IntegrationsPageProps) {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/dashboard/integrations");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const params = await searchParams;
  const requestedBusiness =
    params.business && params.business.trim().length > 0 ? params.business : null;
  if (requestedBusiness && !memberships.some((m) => m.business_id === requestedBusiness)) {
    notFound();
  }
  const selectedId = (requestedBusiness ? requestedBusiness : memberships[0].business_id) as string;

  const db = getSupabase();
  const [business, health] = await Promise.all([
    fetchBusiness(selectedId, db),
    getIntegrationHealth(selectedId, db),
  ]);

  const { calendar, messaging, scheduler } = health;
  const now = Date.now();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <DashboardShell businessId={business.id} businessName={business.name} businessSlug={business.slug ?? null}>
          <IntegrationsContent
            calendar={calendar}
            messaging={messaging}
            scheduler={scheduler}
            businessId={business.id}
            now={now}
          />
        </DashboardShell>
      </main>
      <Footer />
    </>
  );
}
