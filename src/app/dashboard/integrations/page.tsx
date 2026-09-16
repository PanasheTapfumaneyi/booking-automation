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
  type IntegrationHealth,
} from "@/lib/server/integrations/health";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Google Calendar and notification integration health.",
  robots: { index: false, follow: false },
};

interface IntegrationsPageProps {
  searchParams: Promise<{ business?: string }>;
}

// ---------------------------------------------------------------------------
// View model — all relative time strings pre-formatted in the async data layer.
// Date.now() is called exactly once inside buildViewModel, never in JSX render.
// ---------------------------------------------------------------------------

interface IntegrationsViewModel {
  calendarStatus: HealthStatus;
  calendarAccountEmail: string | null;
  calendarId: string | null;
  calendarRequiresReconnect: boolean;
  calendarLastIssue: string | null;
  messagingStatus: HealthStatus;
  messagingEnabled: boolean;
  messagingLastSuccess: string | null;
  messagingRecentFailureCount: number;
  messagingFailures: Array<{ type: string; reason: string; ageLabel: string }>;
  schedulerStatus: HealthStatus;
  schedulerLastChecked: string;
  schedulerLastRunProcessed: number | null;
  businessId: string;
}

function buildViewModel(
  health: IntegrationHealth,
  businessId: string,
): IntegrationsViewModel {
  // Single Date.now() call — in a plain helper, not in a React component body.
  const nowMs = Date.now();
  const { calendar, messaging, scheduler } = health;

  return {
    calendarStatus: calendar.status,
    calendarAccountEmail: calendar.accountEmail ?? null,
    calendarId: calendar.calendarId ?? null,
    calendarRequiresReconnect: calendar.requiresReconnect ?? false,
    calendarLastIssue: calendar.lastFailureAt
      ? relativeTime(calendar.lastFailureAt, nowMs)
      : null,
    messagingStatus: messaging.status,
    messagingEnabled: messaging.enabled,
    messagingLastSuccess: messaging.lastSuccessAt
      ? relativeTime(messaging.lastSuccessAt, nowMs)
      : null,
    messagingRecentFailureCount: messaging.recentFailureCount,
    messagingFailures: messaging.recentFailures.map((f) => ({
      type: f.type,
      reason: f.reason,
      ageLabel: relativeTime(f.at, nowMs),
    })),
    schedulerStatus: scheduler.status,
    schedulerLastChecked: scheduler.lastRunAt
      ? relativeTime(scheduler.lastRunAt, nowMs)
      : "Not yet started",
    schedulerLastRunProcessed: scheduler.lastRunProcessed,
    businessId,
  };
}

// ---------------------------------------------------------------------------
// Pure presentation helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: HealthStatus }) {
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

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className={muted ? "text-ink-soft" : "font-medium text-ink"}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content component — receives plain string view model, no time calls needed
// ---------------------------------------------------------------------------

function IntegrationsView({ vm }: { vm: IntegrationsViewModel }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-ink-soft">Status of your connected services.</p>
      </div>

      {/* Google Calendar */}
      <section
        aria-label="Google Calendar"
        className="rounded-2xl border border-line bg-card p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Google Calendar</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Keeps your calendar in sync with bookings.
            </p>
          </div>
          <StatusBadge status={vm.calendarStatus} />
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {vm.calendarStatus !== "not_connected" && (
            <>
              {vm.calendarAccountEmail && (
                <Row label="Account" value={vm.calendarAccountEmail} />
              )}
              {vm.calendarId && (
                <Row
                  label="Calendar"
                  value={
                    vm.calendarId === "primary" ? "Primary calendar" : vm.calendarId
                  }
                />
              )}
              {vm.calendarLastIssue && (
                <Row label="Last issue" value={vm.calendarLastIssue} muted />
              )}
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {vm.calendarStatus === "not_connected" && (
            <Link
              href={`/api/integrations/google-calendar/connect?business=${vm.businessId}`}
              className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-strong"
            >
              Connect Google Calendar
            </Link>
          )}
          {vm.calendarStatus === "needs_attention" && vm.calendarRequiresReconnect && (
            <>
              <Link
                href={`/api/integrations/google-calendar/connect?business=${vm.businessId}`}
                className="rounded-full bg-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-strong"
              >
                Reconnect
              </Link>
              <p className="mt-1 w-full text-xs text-ink-soft">
                Calendar access needs to be re-authorized. Click Reconnect to fix this.
              </p>
            </>
          )}
          {vm.calendarStatus === "healthy" && (
            <Link
              href={`/settings?business=${vm.businessId}`}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              Manage in settings
            </Link>
          )}
        </div>
      </section>

      {/* WhatsApp notifications */}
      <section
        aria-label="WhatsApp notifications"
        className="rounded-2xl border border-line bg-card p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">WhatsApp notifications</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Sends booking confirmations, reminders and updates to customers.
            </p>
          </div>
          <StatusBadge status={vm.messagingStatus} />
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {vm.messagingStatus === "disabled" ? (
            <p className="text-sm text-ink-soft">
              Customer notifications are currently disabled.
            </p>
          ) : (
            <>
              {vm.messagingLastSuccess && (
                <Row label="Last successful delivery" value={vm.messagingLastSuccess} />
              )}
              {vm.messagingRecentFailureCount > 0 && (
                <Row
                  label="Recent failures"
                  value={String(vm.messagingRecentFailureCount)}
                  muted
                />
              )}
            </>
          )}
        </div>

        {vm.messagingFailures.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-soft">
              Recent issues
            </p>
            <ul className="space-y-1.5">
              {vm.messagingFailures.map((f, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm"
                >
                  <span className="font-medium text-amber-800">{f.type}</span>
                  <span className="mx-1 text-amber-600">—</span>
                  <span className="text-amber-700">{f.reason}</span>
                  <span className="ml-2 text-xs text-amber-500">{f.ageLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {vm.messagingFailures.length === 0 && vm.messagingStatus !== "disabled" && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm text-emerald-700">No recent notification issues.</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {vm.messagingStatus === "disabled" && (
            <Link
              href={`/settings?business=${vm.businessId}`}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              Enable in settings
            </Link>
          )}
          {vm.messagingStatus === "needs_attention" && (
            <p className="text-sm text-ink-soft">
              Kivo is checking this integration. Contact support if the issue persists.
            </p>
          )}
        </div>
      </section>

      {/* Booking reminders */}
      <section
        aria-label="Booking reminders"
        className="rounded-2xl border border-line bg-card p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Booking reminders</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Automatic 1-hour reminder sent to customers before their appointment.
            </p>
          </div>
          <StatusBadge status={vm.schedulerStatus} />
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <Row label="Last checked" value={vm.schedulerLastChecked} />
          {vm.schedulerLastRunProcessed !== null && (
            <Row
              label="Reminders processed in last run"
              value={String(vm.schedulerLastRunProcessed)}
              muted
            />
          )}
        </div>

        {vm.schedulerStatus === "needs_attention" && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm text-ink-soft">
              Kivo is checking this integration. Contact support if the issue persists.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/dashboard/integrations");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const params = await searchParams;
  const requestedBusiness =
    params.business && params.business.trim().length > 0 ? params.business : null;
  if (
    requestedBusiness &&
    !memberships.some((m) => m.business_id === requestedBusiness)
  ) {
    notFound();
  }
  const selectedId = (
    requestedBusiness ? requestedBusiness : memberships[0].business_id
  ) as string;

  const db = getSupabase();
  const [business, health] = await Promise.all([
    fetchBusiness(selectedId, db),
    getIntegrationHealth(selectedId, db),
  ]);

  // buildViewModel calls Date.now() once, here in the async data layer.
  const vm = buildViewModel(health, business.id);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <DashboardShell
          businessId={business.id}
          businessName={business.name}
          businessSlug={business.slug ?? null}
        >
          <IntegrationsView vm={vm} />
        </DashboardShell>
      </main>
      <Footer />
    </>
  );
}
