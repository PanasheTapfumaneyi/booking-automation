import type { BusinessHours } from "@/lib/availability/hours";
import { formatHourLabel, type TodayStatus } from "@/lib/storefront-public";

const WEEKDAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

/**
 * Hours as a business website shows them: clean rows, today's row
 * quietly highlighted, honest Closed states. Data comes from the same
 * canonical availability the booking engine uses.
 */
export default function StorefrontHours({
  hours,
  status,
  todayIndex,
}: {
  hours: BusinessHours;
  status: TodayStatus | null;
  todayIndex: number;
}) {
  return (
    <section id="hours" aria-labelledby="hours-title" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-4xl px-5 py-14 sm:py-20">
        <h2
          id="hours-title"
          className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink"
        >
          Opening hours
        </h2>
        {status && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-sm font-medium text-ink-soft">
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-full ${status.open ? "bg-green-600" : "bg-ink-soft/50"}`}
            />
            {status.label}
          </p>
        )}
        <dl className="mt-6 max-w-2xl">
          {WEEKDAYS.map((day, index) => {
            const entry = (hours as Record<string, { open: string; close: string } | null>)[day.key];
            const isToday = index === todayIndex;
            return (
              <div
                key={day.key}
                className={[
                  "flex items-center justify-between gap-4 border-b border-line/70 px-1 py-3",
                  isToday ? "font-semibold" : "",
                ].join(" ")}
              >
                <dt className="flex items-center gap-2 text-ink">
                  {day.label}
                  {isToday && (
                    <span className="rounded-full bg-blue-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-strong">
                      Today
                    </span>
                  )}
                </dt>
                <dd className="tabular-nums text-ink-soft">
                  {entry ? `${formatHourLabel(entry.open)} – ${formatHourLabel(entry.close)}` : "Closed"}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
