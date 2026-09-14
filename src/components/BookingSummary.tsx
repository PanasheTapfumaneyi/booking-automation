import type { Booking } from "@/types/booking";
import {
  formatLongDate,
  formatTime,
  formatLongDateInZone,
  formatTimeInZone,
  minutesToLabel,
} from "@/lib/availability";

interface BookingSummaryProps {
  booking: Pick<
    Booking,
    | "serviceName"
    | "startTime"
    | "endTime"
    | "servicePrice"
    | "serviceDurationMinutes"
    | "businessName"
    | "businessTimezone"
  >;
  /** Business name shown in the header (falls back to the booking's own). */
  businessName?: string;
  showPrice?: boolean;
}

export default function BookingSummary({
  booking,
  businessName,
  showPrice = true,
}: BookingSummaryProps) {
  const timezone = booking.businessTimezone;
  const date = timezone
    ? formatLongDateInZone(booking.startTime, timezone)
    : formatLongDate(booking.startTime);
  const endDate = timezone
    ? formatLongDateInZone(booking.endTime, timezone)
    : formatLongDate(booking.endTime);
  const start = timezone
    ? formatTimeInZone(booking.startTime, timezone)
    : formatTime(booking.startTime);
  const end = timezone
    ? formatTimeInZone(booking.endTime, timezone)
    : formatTime(booking.endTime);
  const hasDuration = booking.serviceDurationMinutes > 0;
  const multiDay = !hasDuration && date !== endDate;
  const name = booking.businessName ?? businessName ?? "This business";

  return (
    <div className="w-full rounded-xl border border-line bg-card p-5">
      <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">
        {name}
      </p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">{booking.serviceName}</h3>
          <p className="mt-1.5 text-base text-ink-soft">
            {hasDuration
              ? `${date}\n${start} · ${minutesToLabel(booking.serviceDurationMinutes)}`
              : multiDay
                ? `${date} · ${start}\n→ ${endDate} · ${end}`
                : `${date}\n${start} – ${end}`}
          </p>
        </div>
        {showPrice && (
          <p className="text-lg font-semibold tabular-nums">
            Rs {booking.servicePrice.toLocaleString("en-MU")}
          </p>
        )}
      </div>
    </div>
  );
}