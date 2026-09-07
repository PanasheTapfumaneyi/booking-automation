import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CopyBookingLink from "@/components/CopyBookingLink";
import { formatTimeInZone } from "@/lib/availability";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { fetchBusiness } from "@/lib/server/database";
import { getSupabase } from "@/lib/supabase/server";
import {
  listBusinessBookings,
  fetchBusinessBookingCounts,
  getBusinessDayBounds,
} from "@/lib/server/business-bookings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard — Kivo",
  description: "Today's bookings, upcoming appointments, and quick actions.",
};

interface DashboardPageProps {
  searchParams: Promise<{ business?: string }>;
}

/**
 * Operational homepage: today's bookings first, then what's next, plus
 * small bounded counts. No analytics — everything here answers "what needs
 * my attention right now".
 */
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/dashboard");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const params = await searchParams;
  const selectedId =
    (params.business && memberships.some((m) => m.business_id === params.business)
      ? params.business
      : memberships[0].business_id) as string;

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
  const bounds = getBusinessDayBounds(business.timezone, now);
  const [today, upcoming, counts] = await Promise.all([
    listBusinessBookings(
      business.id,
      {
        statuses: ["confirmed", "rescheduled"],
        fromIso: bounds.dayStartUtc,
        toIso: bounds.dayEndUtc,
        limit: 50,
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

  const bookingHref = (bookingId: string) =>
    `/dashboard/bookings/${bookingId}?business=${business.id}`;

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{business.name}</h1>
              <p className="mt-1 text-sm text-ink-soft">
                {bounds.todayKey} · {business.timezone}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CopyBookingLink slug={business.slug} />
              <Link
                href={`/dashboard/bookings?business=${business.id}&new=1`}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-black"
              >
                New booking
              </Link>
            </div>
          </div>

          {switcher.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {switcher.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/dashboard?business=${entry.id}`}
                  className={[
                    "rounded-full border px-4 py-1.5 text-sm",
                    entry.id === business.id
                      ? "border-gold bg-gold-soft font-semibold text-gold-strong"
                      : "border-line bg-card text-ink-soft hover:text-ink",
                  ].join(" ")}
                >
                  {entry.name}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Today" value={String(counts.today)} href={`/dashboard/bookings?business=${business.id}&view=today`} />
            <StatCard label="Upcoming" value={String(counts.upcoming)} href={`/dashboard/bookings?business=${business.id}&view=upcoming`} />
            <StatCard
              label="Notifications failed"
              value={String(counts.failedNotifications)}
              tone={counts.failedNotifications > 0 ? "warn" : undefined}
            />
            <StatCard
              label="Calendar issues"
              value={String(counts.calendarIssues)}
              tone={counts.calendarIssues > 0 ? "warn" : undefined}
              href={`/settings?business=${business.id}`}
            />
          </div>

          <h2 className="mt-10 text-lg font-semibold">Today&apos;s bookings</h2>
          {today.length === 0 ? (
            <EmptyState
              title="No bookings today"
              body="Nothing on the books for today. Share your booking page or create one manually."
              actionHref={`/dashboard/bookings?business=${business.id}&new=1`}
              actionLabel="New booking"
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {today.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={bookingHref(booking.id)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 hover:border-gold/60"
                  >
                    <span>
                      <span className="font-semibold tabular-nums">
                        {formatTimeInZone(booking.startTime, business.timezone)}
                      </span>
                      <span className="text-ink-soft"> · {booking.serviceName}</span>
                      <span className="block text-sm text-ink-soft">
                        {booking.customerName} · {booking.customerPhone}
                      </span>
                    </span>
                    <StatusPill status={booking.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Coming next</h2>
            <Link
              href={`/dashboard/bookings?business=${business.id}&view=upcoming`}
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              All bookings →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              title="No upcoming bookings"
              body="The schedule ahead is clear."
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {upcoming.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={bookingHref(booking.id)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 hover:border-gold/60"
                  >
                    <span>
                      <span className="font-semibold">
                        {booking.startTime.slice(0, 10)} ·{" "}
                        <span className="tabular-nums">
                          {formatTimeInZone(booking.startTime, business.timezone)}
                        </span>
                      </span>
                      <span className="block text-sm text-ink-soft">
                        {booking.serviceName} · {booking.customerName}
                      </span>
                    </span>
                    <StatusPill status={booking.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
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
        </div>
      </main>
      <Footer />
    </>
  );
}

function StatCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  tone?: "warn";
}) {
  const body = (
    <>
      <span className={`text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-red-700" : ""}`}>
        {value}
      </span>
      <span className="mt-1 text-xs text-ink-soft">{label}</span>
    </>
  );
  const className = "flex flex-col rounded-2xl border border-line bg-card px-4 py-3";
  return href ? (
    <Link href={href} className={`${className} hover:border-gold/60`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "cancelled"
      ? "bg-red-50 text-red-700"
      : status === "rescheduled"
        ? "bg-gold-soft text-gold-strong"
        : "bg-gold-soft text-gold-strong";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-card p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{body}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-black"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
