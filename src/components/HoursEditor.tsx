"use client";

import {
  WEEKDAY_KEYS,
  type BusinessHours,
  type WeekdayKey,
  type DayHours,
} from "@/lib/availability";

const DAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

interface HoursEditorProps {
  value: BusinessHours | null;
  onChange: (hours: BusinessHours | null) => void;
  disabled?: boolean;
}

/**
 * Weekly opening-hours editor. Null/absent days are closed; clearing the
 * whole week back to platform defaults is done by the parent (null value).
 */
export default function HoursEditor({ value, onChange, disabled }: HoursEditorProps) {
  function setDay(key: WeekdayKey, open: boolean, time?: { open?: string; close?: string }) {
    const next: BusinessHours = { ...(value ?? {}) };
    if (!open) {
      next[key] = null;
    } else {
      const current = next[key];
      next[key] = {
        open: time?.open ?? (current && typeof current === "object" ? current.open : "09:00"),
        close: time?.close ?? (current && typeof current === "object" ? current.close : "18:00"),
      };
    }
    onChange(next);
  }

  function copyToAllDays(source: WeekdayKey) {
    const current = value?.[source];
    if (!current || typeof current !== "object") return;
    const next: BusinessHours = { ...(value ?? {}) };
    for (const key of WEEKDAY_KEYS) {
      next[key] = { open: current.open, close: current.close };
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2.5">
      {WEEKDAY_KEYS.map((key) => {
        const day = value?.[key] ?? null;
        const isOpen = day !== null && typeof day === "object";
        const invalid = isOpen && (day as DayHours).close <= (day as DayHours).open;
        const dayHours = isOpen ? (day as DayHours) : null;
        return (
          <fieldset key={key} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="w-24 font-medium">{DAY_LABELS[key]}</span>
            <label className="flex items-center gap-1.5 text-ink-soft">
              <input
                type="checkbox"
                aria-label={`${DAY_LABELS[key]} open`}
                checked={isOpen}
                disabled={disabled}
                onChange={(event) => setDay(key, event.target.checked)}
                className="h-4 w-4 accent-[#15547D]"
              />
              Open
            </label>
            {isOpen && dayHours && (
              <>
                <input
                  type="time"
                  aria-label={`${DAY_LABELS[key]} opening time`}
                  value={dayHours.open}
                  disabled={disabled}
                  onChange={(event) =>
                    setDay(key, true, { open: event.target.value, close: dayHours.close })
                  }
                  className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm outline-none focus:border-blue"
                />
                <span className="text-ink-soft">–</span>
                <input
                  type="time"
                  aria-label={`${DAY_LABELS[key]} closing time`}
                  value={dayHours.close}
                  disabled={disabled}
                  onChange={(event) =>
                    setDay(key, true, { open: dayHours.open, close: event.target.value })
                  }
                  className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm outline-none focus:border-blue"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => copyToAllDays(key)}
                  className="text-xs font-medium text-ink-soft hover:text-ink"
                >
                  Copy to all days
                </button>
              </>
            )}
            {invalid && (
              <span className="text-xs font-medium text-red-600">
                Closing must be after opening. For overnight hours, split the day.
              </span>
            )}
          </fieldset>
        );
      })}
      <p className="mt-1 text-xs text-ink-soft">
        Days without a tick are closed and save as closed — there are no hidden default hours.
      </p>
    </div>
  );
}
