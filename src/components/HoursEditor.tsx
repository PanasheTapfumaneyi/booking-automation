"use client";

import {
  WEEKDAY_KEYS,
  type BusinessHours,
  type WeekdayKey,
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

  return (
    <div className="flex flex-col gap-2.5">
      {WEEKDAY_KEYS.map((key) => {
        const day = value?.[key] ?? null;
        const isOpen = day !== null && typeof day === "object";
        return (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-24 font-medium">{DAY_LABELS[key]}</span>
            <label className="flex items-center gap-1.5 text-ink-soft">
              <input
                type="checkbox"
                checked={isOpen}
                disabled={disabled}
                onChange={(event) => setDay(key, event.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              Open
            </label>
            {isOpen && (
              <>
                <input
                  type="time"
                  aria-label={`${DAY_LABELS[key]} opening time`}
                  value={day.open}
                  disabled={disabled}
                  onChange={(event) =>
                    setDay(key, true, { open: event.target.value, close: day.close })
                  }
                  className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm outline-none focus:border-gold"
                />
                <span className="text-ink-soft">–</span>
                <input
                  type="time"
                  aria-label={`${DAY_LABELS[key]} closing time`}
                  value={day.close}
                  disabled={disabled}
                  onChange={(event) =>
                    setDay(key, true, { open: day.open, close: event.target.value })
                  }
                  className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm outline-none focus:border-gold"
                />
              </>
            )}
          </div>
        );
      })}
      <p className="mt-1 text-xs text-ink-soft">
        Leave defaults untouched to use standard hours (Mon–Fri 09:00–18:00, Sat 09:00–16:00, Sun closed).
      </p>
    </div>
  );
}
