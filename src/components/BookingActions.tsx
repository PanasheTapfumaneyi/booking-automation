"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BookingCalendar from "@/components/BookingCalendar";
import { zonedInstant, type BusinessHours } from "@/lib/availability";
import { apiGetBusinessAvailability, BookingApiError } from "@/lib/booking-api";
import type { TimeSlot as SlotOption } from "@/types/booking";

/** Owner actions on one booking: reschedule (same engine) or cancel. */
export default function BookingActions({
  businessId,
  bookingId,
  serviceId,
  status,
  hours,
  bookingMode,
  timezone,
}: {
  businessId: string;
  bookingId: string;
  serviceId: string;
  status: string;
  hours: BusinessHours | null;
  bookingMode: string;
  timezone: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reschedule" | "cancel">("idle");
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const cancelled = status === "cancelled";

  async function loadSlots(nextDateKey: string) {
    setDateKey(nextDateKey);
    setSlot(null);
    setSlots(null);
    setError(null);
    try {
      const availability = await apiGetBusinessAvailability(businessId, {
        serviceId,
        date: nextDateKey,
        bookingId,
      });
      setSlots(availability.kind === "appointment" ? availability.slots : []);
    } catch (loadError: unknown) {
      setSlots([]);
      setError(
        loadError instanceof BookingApiError
          ? loadError.message
          : "We couldn't load available times. Please try again.",
      );
    }
  }

  async function confirmReschedule() {
    let startIso: string;
    let endIso: string | undefined;
    if (bookingMode === "resource") {
      if (!dateKey || !startTime || !endTime) {
        setError("Please choose a date, start and end time.");
        return;
      }
      startIso = zonedInstant(dateKey, startTime, timezone);
      endIso = zonedInstant(dateKey, endTime, timezone);
    } else {
      if (!slot) return;
      startIso = slot.startTime;
      endIso = slot.endTime;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/bookings/${bookingId}/reschedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            endIso ? { startTime: startIso, endTime: endIso } : { startTime: startIso },
          ),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { userMessage?: string };
      } | null;
      if (!response.ok) {
        throw new Error(body?.error?.userMessage ?? "We couldn't reschedule. Please try again.");
      }
      setDone("Rescheduled — the customer gets the usual confirmation.");
      setMode("idle");
      router.refresh();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't reschedule.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/bookings/${bookingId}/cancel`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { userMessage?: string };
      } | null;
      if (!response.ok) {
        throw new Error(body?.error?.userMessage ?? "We couldn't cancel. Please try again.");
      }
      setDone("Cancelled — the customer gets the usual cancellation message.");
      setMode("idle");
      router.refresh();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't cancel.");
    } finally {
      setBusy(false);
    }
  }

  if (cancelled) return null;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {done && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {done}
        </div>
      )}

      {mode === "idle" && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {bookingMode === "capacity" ? (
            <p className="text-sm text-ink-soft">
              Moving between departures isn&apos;t supported yet — cancel and rebook instead.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("reschedule");
                setError(null);
                setDone(null);
              }}
              className="rounded-full bg-ink px-6 py-3 text-base font-semibold text-paper hover:bg-black"
            >
              Reschedule
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMode("cancel");
              setError(null);
              setDone(null);
            }}
            className="rounded-full border border-line bg-card px-6 py-3 text-base font-medium text-ink-soft hover:border-red-300 hover:text-red-600"
          >
            Cancel booking
          </button>
        </div>
      )}

      {mode === "reschedule" && bookingMode === "resource" && (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Choose a new time</h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            The new interval is checked against other reservations for the same item.
          </p>
          <div className="mt-4">
            <BookingCalendar
              selectedDateKey={dateKey}
              onSelectDateKey={(key) => {
                setDateKey(key);
                setError(null);
              }}
              hours={hours}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Start time
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-gold" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              End time
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-gold" />
            </label>
          </div>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              disabled={!dateKey || !startTime || !endTime || busy}
              onClick={confirmReschedule}
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Rescheduling…" : "Confirm new time"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("idle")}
              className="rounded-full border border-line px-6 py-3 text-sm font-medium"
            >
              Back
            </button>
          </div>
        </section>
      )}

      {mode === "reschedule" && bookingMode !== "resource" && (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Choose a new time</h2>
          <div className="mt-4">
            <BookingCalendar
              selectedDateKey={dateKey}
              onSelectDateKey={loadSlots}
              hours={hours}
            />
          </div>
          {dateKey && slots === null && !error && (
            <p className="py-6 text-center text-sm text-ink-soft">Checking available times…</p>
          )}
          {slots !== null && slots.length === 0 && !error && (
            <p className="py-6 text-center text-sm text-ink-soft">No open times on this day.</p>
          )}
          {slots !== null && slots.length > 0 && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {slots.map((option) => (
                  <button
                    key={option.startTime}
                    type="button"
                    onClick={() => setSlot(option)}
                    aria-pressed={slot?.startTime === option.startTime}
                    className={[
                      "rounded-xl border px-3 py-2.5 text-sm font-medium tabular-nums",
                      slot?.startTime === option.startTime
                        ? "border-gold bg-gold-soft text-gold-strong"
                        : "border-line bg-paper hover:border-gold/60",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2.5">
                <button
                  type="button"
                  disabled={!slot || busy}
                  onClick={confirmReschedule}
                  className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? "Rescheduling…" : "Confirm new time"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMode("idle")}
                  className="rounded-full border border-line px-6 py-3 text-sm font-medium"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {mode === "cancel" && (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Cancel this booking?</h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            The time slot opens up again and the customer is notified. The
            booking stays in history.
          </p>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={confirmCancel}
              className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("idle")}
              className="rounded-full border border-line px-6 py-3 text-sm font-medium"
            >
              Keep it
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
