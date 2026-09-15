import { useState } from "react";
import { Skeleton } from "@/components/LoadingState";
import type { Booking } from "@/types/booking";
import type { CapacityAvailability } from "@/lib/booking-api";
import {
  DEFAULT_TIMEZONE,
  formatLongDateInZone,
  formatTimeInZone,
  isoToDateKey,
} from "@/lib/availability";

interface CapacityRescheduleSectionProps {
  booking: Booking;
  dateKey: string | null;
  onDateKeyChange: (key: string) => void;
  sessions: CapacityAvailability["sessions"] | null;
  sessionsError: string | null;
  sessionId: string | null;
  onSessionChange: (id: string, remaining: number) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

/**
 * Customer capacity editor: change the guest count on the current
 * departure, move to another departure, or both.
 *
 * Seat math mirrors the server: the listed `remaining` for the current
 * departure already includes the customer's own seats back (self
 * exclusion), so increases are judged on effective capacity. Everything
 * is re-checked authoritatively server-side — this UI only keeps the
 * stepper within the visible bounds.
 */
export default function CapacityRescheduleSection({
  booking,
  dateKey,
  onDateKeyChange,
  sessions,
  sessionsError,
  sessionId,
  onSessionChange,
  quantity,
  onQuantityChange,
  busy,
  onBack,
  onConfirm,
}: CapacityRescheduleSectionProps) {
  const tz = booking.businessTimezone ?? DEFAULT_TIMEZONE;
  // Captured once per mount (state initializer, not render body) so the
  // "already started" check is stable across re-renders.
  const [nowMs] = useState(() => Date.now());
  const todayKey = isoToDateKey(new Date(nowMs).toISOString(), tz);

  const selected = sessions?.find((s) => s.id === sessionId) ?? null;
  const maxQty = selected ? Math.max(selected.remaining, 1) : booking.quantity;
  const unchanged =
    sessionId === booking.sessionId && quantity === booking.quantity;
  const moved = sessionId !== null && sessionId !== booking.sessionId;

  return (
    <section>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
      >
        ‹ Back to booking
      </button>
      <h1 className="text-2xl font-semibold tracking-tight">
        Change guests or session
      </h1>
      <p className="mt-1.5 text-ink-soft">
        {booking.serviceName} · currently {booking.quantity} guest
        {booking.quantity === 1 ? "" : "s"} on{" "}
        {formatLongDateInZone(booking.startTime, tz)} at{" "}
        {formatTimeInZone(booking.startTime, tz)}.
      </p>

      <div className="mt-6">
        <p className="text-sm font-medium">Guests</p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            aria-label="One fewer guest"
            disabled={quantity <= 1 || busy}
            onClick={() => onQuantityChange(quantity - 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-lg font-medium transition-colors hover:border-blue disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="One more guest"
            disabled={quantity >= maxQty || busy}
            onClick={() => onQuantityChange(quantity + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-lg font-medium transition-colors hover:border-blue disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
          {selected && (
            <span className="text-sm text-ink-soft tabular-nums">
              {selected.remaining} spot{selected.remaining === 1 ? "" : "s"} available
            </span>
          )}
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="capacity-date" className="text-sm font-medium">
          Departure date
        </label>
        <input
          id="capacity-date"
          type="date"
          value={dateKey ?? ""}
          min={todayKey}
          disabled={busy}
          onChange={(e) => {
            if (e.target.value) onDateKeyChange(e.target.value);
          }}
          className="mt-2 w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-blue disabled:opacity-40"
        />
      </div>

      <div className="mt-4" aria-live="polite">
        {sessionsError ? (
          <p className="text-sm text-red-700">{sessionsError}</p>
        ) : sessions === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[60px] w-full rounded-xl" />
            <Skeleton className="h-[60px] w-full rounded-xl" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-card/60 p-5 text-center text-sm text-ink-soft">
            No departures on this date. Try another day.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => {
              const isCurrent = session.id === booking.sessionId;
              const isSelected = session.id === sessionId;
              const past = new Date(session.startTime).getTime() <= nowMs;
              const full = !isCurrent && session.remaining < 1;
              const disabled = past || full || busy;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSessionChange(session.id, session.remaining)}
                    aria-pressed={isSelected}
                    className={[
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      isSelected
                        ? "border-blue bg-blue-mist"
                        : "border-line bg-card hover:border-blue/50",
                      disabled ? "cursor-not-allowed opacity-50" : "",
                    ].join(" ")}
                  >
                    <span>
                      <span className="font-semibold tabular-nums">
                        {formatTimeInZone(session.startTime, tz)}
                      </span>
                      <span className="block text-ink-soft tabular-nums">
                        {isCurrent ? (
                          <>Current · your {booking.quantity} guest{booking.quantity === 1 ? "" : "s"}</>
                        ) : past ? (
                          "Already started"
                        ) : full ? (
                          "Full"
                        ) : (
                          <>{session.remaining} spot{session.remaining === 1 ? "" : "s"} left</>
                        )}
                      </span>
                    </span>
                    {isSelected && (
                      <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue">
                        <span className="h-2 w-2 rounded-full bg-white" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || !sessionId || unchanged}
        className="mt-6 w-full rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Updating…" : moved ? "Move to this departure" : "Save guest count"}
      </button>
      {unchanged && sessionId && (
        <p className="mt-2 text-center text-sm text-ink-soft">
          No changes yet — adjust the guests or pick another departure.
        </p>
      )}
    </section>
  );
}
