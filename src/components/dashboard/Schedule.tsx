import Link from "next/link";
import { StatusBadge } from "./ui";

export interface ScheduleDay {
  key: string;
  weekday: string;
  dayNum: string;
  count: number;
  href: string;
  selected: boolean;
  isToday: boolean;
}

export interface ScheduleBooking {
  id: string;
  href: string;
  time: string;
  serviceName: string;
  customerName: string;
  status: string;
  highlighted?: boolean;
}

/**
 * Interactive schedule: a 7-day strip plus a timeline for the selected
 * day. Day selection is link-driven (server-rendered, no client state),
 * and every booking links to its existing detail page — no duplicate
 * booking-management UI.
 *
 * Blue is used intentionally: the selected day is filled blue, days with
 * bookings carry a blue dot, and the timeline rail is pale blue. Status
 * always has a text badge — color is never the only signal.
 */
export default function Schedule({
  days,
  dayLabel,
  bookings,
  emptyTitle,
  emptyBody,
}: {
  days: ScheduleDay[];
  dayLabel: string;
  bookings: ScheduleBooking[];
  emptyTitle: string;
  emptyBody: string;
}) {
  return (
    <div>
      <nav aria-label="Schedule days" className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day) => (
          <Link
            key={day.key}
            href={day.href}
            aria-current={day.selected ? "date" : undefined}
            aria-label={`${day.weekday} ${day.dayNum}${day.count > 0 ? `, ${day.count} booking${day.count === 1 ? "" : "s"}` : ", no bookings"}`}
            className={[
              "flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-center transition-colors",
              day.selected
                ? "border-blue bg-blue text-white"
                : "border-line bg-card hover:border-blue/50",
            ].join(" ")}
          >
            <span
              className={`text-[11px] font-medium uppercase tracking-wide ${day.selected ? "text-white/70" : "text-muted"}`}
            >
              {day.isToday ? "Today" : day.weekday}
            </span>
            <span className={`text-lg font-bold tabular-nums leading-none ${day.selected ? "text-white" : "text-ink"}`}>
              {day.dayNum}
            </span>
            <span className="flex h-2 items-center" aria-hidden="true">
              {day.count > 0 && (
                <span className={`h-1.5 w-1.5 rounded-full ${day.selected ? "bg-white" : "bg-blue"}`} />
              )}
            </span>
          </Link>
        ))}
      </nav>

      <p className="mt-5 text-sm font-semibold text-ink" aria-live="polite">
        {dayLabel}
      </p>

      {bookings.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-line bg-card/60 p-6 text-center">
          <p className="font-medium">{emptyTitle}</p>
          <p className="mt-1 text-sm text-ink-soft">{emptyBody}</p>
        </div>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <Link
                href={booking.href}
                className={[
                  "group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                  booking.highlighted
                    ? "border-blue/60 bg-blue-mist hover:border-blue"
                    : "border-line bg-card hover:border-blue/50 hover:bg-blue-mist/50",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={`h-10 w-1 shrink-0 rounded-full ${booking.status === "cancelled" ? "bg-line-strong" : booking.highlighted ? "bg-blue" : "bg-blue/40"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold tabular-nums">{booking.time}</span>
                    <span className="truncate text-sm text-ink-soft">{booking.serviceName}</span>
                  </span>
                  <span className="block truncate text-sm text-ink-soft">
                    {booking.customerName}
                  </span>
                </span>
                {booking.highlighted && (
                  <span className="hidden shrink-0 rounded-full bg-blue px-2 py-0.5 text-[11px] font-semibold text-white sm:inline">
                    Up next
                  </span>
                )}
                <StatusBadge status={booking.status} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
