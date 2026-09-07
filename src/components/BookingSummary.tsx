import type { Booking } from "@/types/booking";
import { DEMO_BUSINESS } from "@/lib/demo";
import { formatLongDate, formatTime, minutesToLabel } from "@/lib/availability";

interface BookingSummaryProps {
  booking: Pick<
    Booking,
    | "serviceName"
    | "startTime"
    | "endTime"
    | "servicePrice"
    | "serviceDurationMinutes"
  >;
  showPrice?: boolean;
}

export default function BookingSummary({
  booking,
  showPrice = true,
}: BookingSummaryProps) {
  const date = formatLongDate(booking.startTime);
  const start = formatTime(booking.startTime);
  const end = formatTime(booking.endTime);
  const hasDuration = booking.serviceDurationMinutes > 0;

  return (
    <div className="w-full rounded-xl border border-line bg-card p-5">
      <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">
        {DEMO_BUSINESS.name}
      </p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">{booking.serviceName}</h3>
          <p className="mt-1.5 text-base text-ink-soft">
            {date}
            <br />
            {hasDuration
              ? `${start} · ${minutesToLabel(booking.serviceDurationMinutes)}`
              : `${start} – ${end}`}
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