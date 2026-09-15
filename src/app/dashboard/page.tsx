import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CopyBookingLink from "@/components/CopyBookingLink";
import DashboardShell from "@/components/dashboard/DashboardShell";
import Schedule from "@/components/dashboard/Schedule";
import {
  EmptyState,
  SectionHeading,
  StatCard,
  StatusBadge,
  primaryActionClass,
} from "@/components/dashboard/ui";
import {
  addDaysKey,
  formatLongDateInZone,
  formatTimeInZone,
  getLocalDayInfo,
  isoToDateKey,
} from "@/lib/availability";
import {
  displayNameFromEmail,
  getDaypartInZone,
  greetingForDaypart,
} from "@/lib/greeting";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { fetchBusiness } from "@/lib/server/database";
import { getSupabase } from "@/lib/supabase/server";
import {
  listBusinessBookings,
  fetchBusinessBookingCounts,
  getBusinessDayBounds,
} from "@/lib/server/business-bookings";
import { listResources, listSessions } from "@/lib/server/businesses";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Today's bookings, upcoming appointments, and quick actions.",
  robots: { index: false, follow: false },
};

interface DashboardPageProps {
  searchParams: Promise<{ business?: string; day?: string }>;
}

/**
 * Operational homepage: greeting, today's overview, an interactive
 * week schedule, what's next, and mode-specific panels. Everything here
 * answers "what needs my attention right now" — no analytics.
 */
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/dashboard");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const params = await searchParams;
  // A provided but unowned business id is a 404 (KIVO-027), never a silent
  // fallback to another business.
  const requestedBusiness =
    params.business && params.business.trim().length > 0 ? params.business : null;
  if (requestedBusiness && !memberships.some((m) => m.business_id === requestedBusiness)) {
    notFound();
  }
  const selectedId = (requestedBusiness ? requestedBusiness : memberships[0].business_id) as string;

  const db = getSupabase();
  const business = await fetchBusiness(selectedId, db).catch(() => null);
  if (!business) redirect("/onboarding");

  const switcher: Array<{ id: string; name: string }> = [];
  if (memberships.length > 1) {
    for (const membership of memberships) {
      const row = await fetchBusiness(membership.business_id, db).catch(() => null);
      if (row) switcher.push({ id: row.id, name: row.name });
    }
  }

  const now = new Date();
  const tz = business.timezone;
  const bounds = getBusinessDayBounds(tz, now);
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(now);

  // Server-computed greeting in the business timezone — deterministic per
  // request, so there is no server/client hydration mismatch.
  const greeting = greetingForDaypart(getDaypartInZone(tz, now));
  const displayName = displayNameFromEmail(user.email);

  // One bounded 7-day query feeds the week strip and the selected-day
  // timeline (live bookings only).
  const weekEndUtc = getLocalDayInfo(addDaysKey(bounds.todayKey, 7), tz).dayStartUtc;
  const [weekBookings, upcoming, counts] = await Promise.all([
    listBusinessBookings(
      business.id,
      {
        statuses: ["confirmed", "rescheduled"],
        fromIso: bounds.dayStartUtc,
        toIso: weekEndUtc,
        limit: 200,
      },
      db,
    ),
    listBusinessBookings(
      business.id,
      { statuses: ["confirmed", "rescheduled"], fromIso: bounds.dayEndUtc, limit: 10 },
      db,
    ),
    fetchBusinessBookingCounts(business, now, db),
  ]);

  // Mode-specific overview panels (only the current mode's section renders).
  const modeResources =
    business.booking_mode === "resource" ? await listResources(business.id, db) : [];
  const modeSessions =
    business.booking_mode === "capacity" ? await listSessions(business.id, db) : [];

  const bookingHref = (bookingId: string) =>
    `/dashboard/bookings/${bookingId}?business=${business.id}`;

  const byDay = new Map<string, typeof weekBookings>();
  for (const booking of weekBookings) {
    const key = isoToDateKey(booking.startTime, tz);
    const list = byDay.get(key) ?? [];
    list.push(booking);
    byDay.set(key, list);
  }

  const weekKeys = Array.from({ length: 7 }, (_, i) => addDaysKey(bounds.todayKey, i));
  const requestedDay = params.day && params.day.trim().length > 0 ? params.day.trim() : null;
  const selectedDay = requestedDay && weekKeys.includes(requestedDay) ? requestedDay : bounds.todayKey;
  const selectedBookings = (byDay.get(selectedDay) ?? [])
    .slice()
    .sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));

  const dayHref = (key: string) => `/dashboard?business=${business.id}&day=${key}`;
  const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz });
  const days = weekKeys.map((key) => {
    const dayStart = getLocalDayInfo(key, tz).dayStartUtc;
    return {
      key,
      weekday: weekdayFmt.format(new Date(dayStart)),
      dayNum: String(Number(key.slice(8, 10))),
      count: byDay.get(key)?.length ?? 0,
      href: dayHref(key),
      selected: key === selectedDay,
      isToday: key === bounds.todayKey,
    };
  });

  const selectedLabel =
    selectedDay === bounds.todayKey
      ? `Today · ${todayLabel}`
      : formatLongDateInZone(getLocalDayInfo(selectedDay, tz).dayStartUtc, tz);

  const nowIso = now.toISOString();
  const nextBooking =
    selectedBookings.find((b) => b.startTime >= nowIso) ??
    (selectedDay === bounds.todayKey ? upcoming[0] : undefined);
  const highlightId =
    selectedDay === bounds.todayKey && nextBooking ? nextBooking.id : undefined;

  const todayCount = byDay.get(bounds.todayKey)?.length ?? 0;
  const attentionCount = counts.failedNotifications + counts.calendarIssues;

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <DashboardShell
          businessId={business.id}
          businessName={business.name}
          businessSlug={business.slug}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-ink-soft">
                {todayLabel} · {tz}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                {greeting}
                {displayName ? `, ${displayName}` : ""}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                Here&apos;s today at {business.name} · {todayCount} booking
                {todayCount === 1 ? "" : "s"} on the schedule.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CopyBookingLink slug={business.slug} />
              <Link
                href={`/dashboard/bookings?business=${business.id}&new=1`}
                className={primaryActionClass}
              >
                New booking
              </Link>
            </div>
          </div>

          {switcher.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Switch business">
              {switcher.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/dashboard?business=${entry.id}`}
                  aria-current={entry.id === business.id ? "true" : undefined}
                  className={[
                    "rounded-full border px-4 py-1.5 text-sm transition-colors",
                    entry.id === business.id
                      ? "border-blue bg-blue-soft font-semibold text-blue-strong"
                      : "border-line bg-card text-ink-soft hover:text-ink",
                  ].join(" ")}
                >
                  {entry.name}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-3">
            <StatCard
              label="Today"
              value={String(counts.today)}
              href={`/dashboard/bookings?business=${business.id}&view=today`}
            />
            <StatCard
              label="Upcoming"
              value={String(counts.upcoming)}
              href={`/dashboard/bookings?business=${business.id}&view=upcoming`}
            />
            <StatCard
              label="Needs attention"
              value={String(attentionCount)}
              tone={attentionCount > 0 ? "warn" : undefined}
              href={attentionCount > 0 ? `/settings?business=${business.id}` : undefined}
            />
          </div>

          {nextBooking && selectedDay === bounds.todayKey && (
            <Link
              href={bookingHref(nextBooking.id)}
              className="mt-4 flex items-center gap-4 rounded-2xl border border-blue/40 bg-blue-mist px-5 py-4 transition-colors hover:border-blue"
            >
              <span className="min-w-0 flex-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-strong">
                  Up next · <span className="tabular-nums">{formatTimeInZone(nextBooking.startTime, tz)}</span>
                </span>
                <span className="mt-0.5 block truncate font-semibold">
                  {nextBooking.serviceName} · {nextBooking.customerName}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-blue-strong">
                View details →
              </span>
            </Link>
          )}

          <section aria-label="Schedule" className="mt-8">
            <SectionHeading
              title="Schedule"
              actionHref={`/dashboard/bookings?business=${business.id}&view=upcoming`}
              actionLabel="All bookings"
            />
            <div className="mt-4">
              <Schedule
                days={days}
                dayLabel={selectedLabel}
                bookings={selectedBookings.map((booking) => ({
                  id: booking.id,
                  href: bookingHref(booking.id),
                  time: formatTimeInZone(booking.startTime, tz),
                  serviceName: booking.serviceName,
                  customerName: `${booking.customerName} · ${booking.customerPhone}`,
                  status: booking.status,
                  highlighted: booking.id === highlightId,
                }))}
                emptyTitle={
                  selectedDay === bounds.todayKey
                    ? "Nothing scheduled today"
                    : "Nothing scheduled this day"
                }
                emptyBody="New bookings appear here as customers book."
              />
            </div>
          </section>

          <section aria-label="Coming next" className="mt-8">
            <SectionHeading
              title="Coming next"
              actionHref={`/dashboard/bookings?business=${business.id}&view=upcoming`}
              actionLabel="All bookings"
            />
            {upcoming.length === 0 ? (
              <EmptyState
                title="No upcoming bookings"
                body="The schedule ahead is clear."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {upcoming.slice(0, 5).map((booking) => (
                  <li key={booking.id}>
                    <Link
                      href={bookingHref(booking.id)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:border-blue/50"
                    >
                      <span className="min-w-0">
                        <span className="font-semibold">
                          {booking.startTime.slice(0, 10)} ·{" "}
                          <span className="tabular-nums">
                            {formatTimeInZone(booking.startTime, tz)}
                          </span>
                        </span>
                        <span className="block truncate text-sm text-ink-soft">
                          {booking.serviceName} · {booking.customerName}
                        </span>
                      </span>
                      <StatusBadge status={booking.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {business.booking_mode === "resource" && (
            <section aria-label="Rental items" className="mt-8">
              <SectionHeading
                title="Items"
                actionHref={`/settings?business=${business.id}`}
                actionLabel="Manage items"
              />
              {modeResources.filter((r) => r.active).length === 0 ? (
                <EmptyState
                  title="No rental items yet"
                  body="Add your first item in settings to start taking bookings."
                />
              ) : (
                <ul className="mt-4 flex flex-col gap-2.5">
                  {modeResources
                    .filter((r) => r.active)
                    .map((resource) => (
                      <li key={resource.id}>
                        <Link
                          href={`/dashboard/bookings?business=${business.id}&resourceId=${resource.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:border-blue/50"
                        >
                          <span className="font-medium">{resource.name}</span>
                          <span className="shrink-0 text-sm text-blue-strong">View bookings →</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          )}

          {business.booking_mode === "capacity" && (
            <section aria-label="Sessions" className="mt-8">
              <SectionHeading
                title="Departures"
                actionHref={`/settings?business=${business.id}`}
                actionLabel="Manage sessions"
              />
              {modeSessions.filter((s) => s.active).length === 0 ? (
                <EmptyState
                  title="No upcoming departures"
                  body="Add a session in settings to start taking bookings."
                />
              ) : (
                <ul className="mt-4 flex flex-col gap-2.5">
                  {modeSessions
                    .filter((s) => s.active)
                    .map((session) => (
                      <li key={session.id}>
                        <Link
                          href={`/dashboard/bookings?business=${business.id}&sessionId=${session.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:border-blue/50"
                        >
                          <span className="min-w-0">
                            <span className="font-medium">
                              {session.service_name ?? "Session"}
                            </span>
                            <span className="block text-sm text-ink-soft tabular-nums">
                              {formatTimeInZone(session.start_time, tz)} ·{" "}
                              {session.booked}/{session.capacity} booked
                            </span>
                          </span>
                          <span className="shrink-0 text-sm text-blue-strong">View bookings →</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          )}

          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href={`/dashboard/bookings?business=${business.id}`} className="font-medium text-ink-soft hover:text-ink">
              All bookings →
            </Link>
            <Link href={`/settings?business=${business.id}`} className="font-medium text-ink-soft hover:text-ink">
              Settings →
            </Link>
            <Link href="/logout" className="font-medium text-ink-soft hover:text-ink">
              Log out
            </Link>
          </div>
        </DashboardShell>
      </main>
      <Footer />
    </>
  );
}
