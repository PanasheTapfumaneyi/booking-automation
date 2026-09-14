import { WEEKDAY_KEYS, type BusinessHours } from "@/lib/availability/hours";

interface OpeningHoursProps {
  hours: Record<string, { open: string; close: string } | null> | null;
  timezone: string;
}

const WEEKDAY_LABEL: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function getTodayIndex(timezone: string): number {
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: timezone,
  }).format(new Date());
  const map: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  return map[weekday] ?? new Date().getDay();
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${m} ${suffix}`;
}

function getNextOpenInfo(
  hours: BusinessHours,
  timezone: string,
): string | null {
  const now = new Date();
  const todayKey = WEEKDAY_KEYS[getTodayIndex(timezone)];
  const todayHours = hours[todayKey];

  if (todayHours) {
    const [oh, om] = todayHours.open.split(":").map(Number);
    const [ch, cm] = todayHours.close.split(":").map(Number);
    const openMs = new Date(now);
    openMs.setHours(oh, om, 0, 0);
    const closeMs = new Date(now);
    closeMs.setHours(ch, cm, 0, 0);

    if (now >= openMs && now < closeMs) {
      const closeStr = formatTime(todayHours.close);
      return `Open now \u00b7 Closes at ${closeStr}`;
    }
  }

  for (let i = 1; i <= 7; i++) {
    const idx = (getTodayIndex(timezone) + i) % 7;
    const key = WEEKDAY_KEYS[idx];
    const day = hours[key];
    if (day) {
      const label = i === 1 ? "tomorrow" : `on ${WEEKDAY_LABEL[key]}`;
      return `Closed \u00b7 Opens ${label} at ${formatTime(day.open)}`;
    }
  }

  return "Closed";
}

export default function OpeningHours({ hours, timezone }: OpeningHoursProps) {
  if (!hours) return null;

  const todayIdx = getTodayIndex(timezone);
  const statusText = getNextOpenInfo(hours as BusinessHours, timezone);

  return (
    <div>
      {statusText && (
        <p className="mb-4 rounded-lg bg-brand-soft px-3.5 py-2 text-sm font-medium text-brand">
          {statusText}
        </p>
      )}

      <dl className="space-y-0">
        {WEEKDAY_KEYS.map((day, idx) => {
          const h = hours[day];
          const isToday = idx === todayIdx;

          return (
            <div
              key={day}
              className={[
                "flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-0",
                isToday ? "bg-brand-soft/30" : "",
              ].join(" ")}
            >
              <dt className="flex items-center gap-2">
                <span className={isToday ? "font-semibold text-brand" : "text-ink-soft"}>
                  {WEEKDAY_LABEL[day]}
                </span>
                {isToday && (
                  <span className="inline-flex items-center rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Today
                  </span>
                )}
              </dt>
              <dd className="font-medium tabular-nums text-ink">
                {h ? `${formatTime(h.open)} – ${formatTime(h.close)}` : "Closed"}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
