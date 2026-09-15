"use client";

import { useMemo, useState } from "react";
import {
  BOOKING_WINDOW_DAYS,
  isDateKeyAvailable,
  toDateKey,
  DEFAULT_TIMEZONE,
  type BusinessHours,
} from "@/lib/availability";

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface BookingCalendarProps {
  selectedDateKey: string | null;
  onSelectDateKey: (dateKey: string) => void;
  /** Per-business hours; omitted → platform defaults. */
  hours?: BusinessHours | null;
  /** IANA timezone for the "today" basis; defaults to the platform default. */
  timezone?: string;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export default function BookingCalendar({
  selectedDateKey,
  onSelectDateKey,
  hours,
  timezone,
}: BookingCalendarProps) {
  const todayKey = useMemo(
    () => toDateKey(new Date(), timezone ?? DEFAULT_TIMEZONE),
    [timezone],
  );
  const [monthKey, setMonthKey] = useState(() => todayKey.slice(0, 7));

  const horizonKey = useMemo(() => {
    const [year, month, day] = todayKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const padded = (value: number) => String(value).padStart(2, "0");
    return `${date.getUTCFullYear()}-${padded(date.getUTCMonth() + 1)}-${padded(
      date.getUTCDate() + BOOKING_WINDOW_DAYS,
    )}`;
  }, [todayKey]);

  const canGoPrevious = monthKey > todayKey.slice(0, 7);

  const { cells, monthLabel, lastDayOfMonthKey } = useMemo(() => {
    const [year, month] = monthKey.split("-").map(Number);
    const count = daysInMonth(year, month);
    const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const offset = (firstDow + 6) % 7; // Monday-first grid

    const result: (string | null)[] = [];
    for (let i = 0; i < offset; i++) result.push(null);
    for (let day = 1; day <= count; day++) {
      result.push(`${monthKey}-${String(day).padStart(2, "0")}`);
    }

    const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
      "en-MU",
      { month: "long", year: "numeric", timeZone: "UTC" },
    );

    return {
      cells: result,
      monthLabel: label,
      lastDayOfMonthKey: `${monthKey}-${String(count).padStart(2, "0")}`,
    };
  }, [monthKey]);

  // Next stays enabled while the displayed month still contains any in-window
  // day, so dates early in the following month remain reachable (KIVO-005).
  const canGoNext = lastDayOfMonthKey < horizonKey;

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthKey((current) => addMonthKey(current, -1))}
          disabled={!canGoPrevious}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink transition-colors hover:border-blue disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="text-sm font-semibold">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setMonthKey((current) => addMonthKey(current, 1))}
          disabled={!canGoNext}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink transition-colors hover:border-blue disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wide text-ink-soft">
        {WEEKDAY_HEADERS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateKey, index) => {
          if (!dateKey) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const available = isDateKeyAvailable(dateKey, undefined, hours);
          const selected = dateKey === selectedDateKey;
          const current = dateKey === todayKey;

          const [year, month, day] = dateKey.split("-").map(Number);
          const dayLabel = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
            "en-MU",
            {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            },
          );

          return (
            <button
              key={dateKey}
              type="button"
              disabled={!available}
              onClick={() => onSelectDateKey(dateKey)}
              aria-label={`${dayLabel}${available ? "" : " — unavailable"}`}
              className={[
                "relative flex aspect-square items-center justify-center rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:text-ink-soft/40",
                selected
                  ? "bg-blue font-semibold text-white"
                  : available
                    ? "border border-line bg-card font-medium hover:border-blue hover:bg-blue-soft"
                    : "bg-transparent",
                current && !selected ? "ring-1 ring-blue ring-inset" : "",
              ].join(" ")}
            >
              {Number(dateKey.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}