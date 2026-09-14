import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingActions from "@/components/BookingActions";
import { StatusPill } from "@/app/dashboard/page";
import { formatTimeInZone, formatLongDateInZone } from "@/lib/availability";
import { formatMauritianRupees } from "@/lib/resource-pricing";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import {
  fetchBusinessBookingById,
  fetchBookingNotificationSummary,
} from "@/lib/server/business-bookings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking details — Kivo",
  description: "Review, reschedule or cancel a booking.",
};

interface DetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ business?: string }>;
}

/** Business-side booking detail: safe fields, timeline, calendar, actions. */
export default async function BookingDetailPage({ params, searchParams }: DetailPageProps) {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const { id: bookingId } = await params;
  const query = await searchParams;
  const selectedId =
    (query.business && memberships.some((m) => m.business_id === query.business)
      ? query.business
      : memberships[0].business_id) as string;

  // Ownership is verified inside requireBusinessOwner; unknown ids and other
  // businesses' bookings share one safe 404 below.
  const ctx = await requireBusinessOwner(selectedId).catch(() => null);
  if (!ctx) notFound();
  const db = getSupabase();
  const booking = await fetchBusinessBookingById(ctx.business.id, bookingId, db);
  if (!booking) notFound();
  const notifications = await fetchBookingNotificationSummary(booking.id, db);

  const tz = ctx.business.timezone;
  const backHref = `/dashboard/bookings?business=${ctx.business.id}`;

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-xl px-5 py-10">
          <Link href={backHref} className="text-sm font-medium text-ink-soft hover:text-ink">
            ‹ All bookings
          </Link>
          <div className="mt-3 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {formatLongDateInZone(booking.startTime, tz)}
            </h1>
            <StatusPill status={booking.status} />
          </div>
          <p className="mt-1 tabular-nums text-ink-soft">
            {formatTimeInZone(booking.startTime, tz)} – {formatTimeInZone(booking.endTime, tz)} · {tz}
          </p>

          <section className="mt-6 rounded-2xl border border-line bg-card p-5">
            <h2 className="font-semibold">Customer</h2>
            <p className="mt-2 text-sm">{booking.customerName}</p>
            <p className="text-sm text-ink-soft tabular-nums">{booking.customerPhone}</p>
            {booking.customerEmail && <p className="text-sm text-ink-soft">{booking.customerEmail}</p>}
          </section>

          <section className="mt-4 rounded-2xl border border-line bg-card p-5">
            <h2 className="font-semibold">Booking</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Service</dt>
                <dd className="text-right font-medium">{booking.serviceName}</dd>
              </div>
              {booking.resourceName && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Item</dt>
                  <dd className="text-right font-medium">{booking.resourceName}</dd>
                </div>
              )}
              {booking.sessionId && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Guests</dt>
                  <dd className="text-right font-medium tabular-nums">{booking.quantity}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Total</dt>
                <dd className="text-right font-semibold tabular-nums">
                  {formatMauritianRupees(booking.servicePrice)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Status</dt>
                <dd className="text-right font-medium">{booking.status}</dd>
              </div>
              {booking.previousStartTime && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Previously</dt>
                  <dd className="text-right font-medium tabular-nums">
                    {formatLongDateInZone(booking.previousStartTime, tz)},{" "}
                    {formatTimeInZone(booking.previousStartTime, tz)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Created</dt>
                <dd className="text-right font-medium tabular-nums">
                  {formatLongDateInZone(booking.createdAt, tz)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-4 rounded-2xl border border-line bg-card p-5">
            <h2 className="font-semibold">Notifications</h2>
            {notifications.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No notifications recorded for this booking.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {notifications.map((n, index) => (
                  <li
                    key={`${n.event_type}-${n.recipient_type}-${index}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>
                      {humanEvent(n.event_type)} · {n.recipient_type === "customer" ? "Customer" : "Business"}
                    </span>
                    <NotificationPill status={n.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-4 rounded-2xl border border-line bg-card p-5">
            <h2 className="font-semibold">Google Calendar</h2>
            <p className="mt-2 text-sm">
              {booking.calendarSyncStatus === "synced" && "Synced with Google Calendar."}
              {booking.calendarSyncStatus === "not_connected" && "Calendar not connected — bookings are kept in Kivo only."}
              {booking.calendarSyncStatus === "pending" && "Calendar sync pending."}
              {booking.calendarSyncStatus === "failed" && (
                <>
                  Sync needs attention.{" "}
                  <Link href={`/settings?business=${ctx.business.id}`} className="font-medium underline">
                    Check the calendar connection
                  </Link>
                </>
              )}
            </p>
          </section>

          <div className="mt-6">
            <BookingActions
              businessId={ctx.business.id}
              bookingId={booking.id}
              serviceId={booking.serviceId}
              status={booking.status}
              hours={ctx.business.availability ?? null}
              bookingMode={ctx.business.booking_mode}
              timezone={ctx.business.timezone}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function humanEvent(eventType: string): string {
  switch (eventType) {
    case "booking.created":
      return "Booking confirmed";
    case "booking.rescheduled":
      return "Rescheduled";
    case "booking.cancelled":
      return "Cancelled";
    case "booking.reminder.24h":
      return "Reminder 24h";
    case "booking.reminder.2h":
      return "Reminder 2h";
    default:
      return eventType;
  }
}

function NotificationPill({ status }: { status: string }) {
  const tone =
    status === "sent"
      ? "bg-gold-soft text-gold-strong"
      : status === "failed"
        ? "bg-red-50 text-red-700"
        : "bg-card text-ink-soft border border-line";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}
