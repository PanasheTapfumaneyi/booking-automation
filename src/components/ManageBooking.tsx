"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Booking, TimeSlot as SlotOption } from "@/types/booking";
import { formatTime, formatLongDate } from "@/lib/availability";
import {
  apiGetBooking,
  apiRescheduleBooking,
  apiCancelBooking,
  apiGetAvailability,
  BookingApiError,
} from "@/lib/booking-api";
import BookingSummary from "@/components/BookingSummary";
import BookingCalendar from "@/components/BookingCalendar";
import TimeSlot from "@/components/TimeSlot";

type Mode = "view" | "reschedule" | "cancel" | "cancelled" | "rescheduled";

interface ManageBookingProps {
  token: string;
}

function statusLabel(status: Booking["status"]): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "rescheduled":
      return "Rescheduled";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    case "no_show":
      return "No show";
    default:
      return status;
  }
}

export default function ManageBooking({ token }: ManageBookingProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("view");
  const [rescheduleStep, setRescheduleStep] = useState<"date" | "slot">("date");
  const [newDateKey, setNewDateKey] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState<SlotOption | null>(null);
  const [slotQuery, setSlotQuery] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // NOTE: the page renders this component with key={token}, so a new manage
  // link always mounts fresh state — no reset-on-token-change is needed here.
  useEffect(() => {
    let cancelled = false;

    apiGetBooking(token)
      .then((found) => {
        if (cancelled) return;
        setBooking(found);
        setBookingError(null);
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        if (fetchError instanceof BookingApiError && fetchError.isNotfound) {
          setNotFound(true);
        } else {
          setBookingError(
            fetchError instanceof BookingApiError
              ? fetchError.message
              : "We couldn't load this appointment. Please try again.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const slotsLoading = !slotsError && slotQuery !== null && slots === null;

  useEffect(() => {
    if (!slotQuery || !booking) return;

    let cancelled = false;
    apiGetAvailability({
      serviceId: booking.serviceId,
      date: slotQuery,
      excludeBookingToken: booking.manageToken,
    })
      .then((availability) => {
        if (cancelled) return;
        setSlots(availability.slots);
        setSlotsError(null);
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        setSlots([]);
        setSlotsError(
          fetchError instanceof BookingApiError
            ? fetchError.message
            : "We couldn't load available times. Please try again.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [slotQuery, booking, retryCount]);

  function startReschedule() {
    setMode("reschedule");
    setRescheduleStep("date");
    setNewDateKey(null);
    setNewSlot(null);
    setSlotQuery(null);
    setSlots(null);
    setSlotsError(null);
    setError(null);
  }

  function startCancel() {
    setMode("cancel");
    setError(null);
  }

  function handleSelectNewDate(dateKey: string) {
    setNewDateKey(dateKey);
    setNewSlot(null);
    setSlots(null);
    setSlotsError(null);
    setRescheduleStep("slot");
    setSlotQuery((current) => (current === dateKey ? current : dateKey));
  }

  function handleConfirmReschedule() {
    if (!booking || !newSlot) return;

    setBusy(true);
    setError(null);

    apiRescheduleBooking(token, newSlot.startTime)
      .then((updated) => {
        setBooking(updated);
        setMode("rescheduled");
        setSlotQuery(null);
        setSlots(null);
      })
      .catch((rescheduleError: unknown) => {
        setMode("view");
        setError(
          rescheduleError instanceof BookingApiError
            ? rescheduleError.message
            : "We couldn't reschedule your appointment. Please try again.",
        );
      })
      .finally(() => {
        setBusy(false);
      });
  }

  function handleConfirmCancel() {
    if (!booking) return;

    setBusy(true);
    setError(null);

    apiCancelBooking(token)
      .then((updated) => {
        setBooking(updated);
        setMode("cancelled");
      })
      .catch((cancelError: unknown) => {
        setError(
          cancelError instanceof BookingApiError
            ? cancelError.message
            : "We couldn't cancel your appointment. Please try again.",
        );
        if (cancelError instanceof BookingApiError && cancelError.isCancelled) {
          setBooking((current) =>
            current ? { ...current, status: "cancelled" } : current,
          );
          setMode("cancelled");
        }
      })
      .finally(() => {
        setBusy(false);
      });
  }

  if (notFound) {
    return (
      <div className="mx-auto w-full max-w-lg px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Appointment not found
        </h1>
        <p className="mt-2 text-ink-soft">
          We couldn&apos;t find this appointment. The link may be incorrect or
          the appointment may have been removed.
        </p>
        <Link
          href="/book"
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-base font-semibold text-paper hover:bg-black"
        >
          Book an appointment
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-24 text-center">
        {bookingError ? (
          <p className="text-red-700">{bookingError}</p>
        ) : (
          <p className="text-ink-soft">Loading your appointment…</p>
        )}
      </div>
    );
  }

  const isCancelled = booking.status === "cancelled";

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10">
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {mode === "rescheduled" && (
        <section className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold text-white">
            <span className="text-2xl font-bold">✓</span>
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Appointment rescheduled
          </h1>
          <p className="mt-1.5 text-ink-soft">
            Your appointment has moved to the new time below. A confirmation has
            been sent.
          </p>
          <div className="mt-8 text-left">
            {booking.previousStartTime && (
              <p className="mb-3 flex items-center justify-center gap-3 text-sm text-ink-soft">
                <s>
                  {formatLongDate(booking.previousStartTime)} ·{" "}
                  {formatTime(booking.previousStartTime)}
                </s>
                <span aria-hidden>→</span>
              </p>
            )}
            <BookingSummary booking={booking} />
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/manage/${token}`}
              className="rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper hover:bg-black"
            >
              View appointment
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              Back to Fade District
            </Link>
          </div>
        </section>
      )}

      {mode === "cancelled" && (
        <section className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-card text-ink-soft">
            <span className="text-2xl">✕</span>
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Appointment cancelled
          </h1>
          <p className="mt-1.5 text-ink-soft">
            Your appointment has been cancelled. We hope to see you again soon.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/book"
              className="rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper hover:bg-black"
            >
              Book a new appointment
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              Back to Fade District
            </Link>
          </div>
        </section>
      )}

      {mode === "reschedule" && (
        <section>
          <button
            type="button"
            onClick={() => {
              setMode("view");
              setError(null);
            }}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to appointment
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose a new time
          </h1>
          <p className="mt-1.5 text-ink-soft">
            {booking.serviceName} · move from {formatLongDate(booking.startTime)}{" "}
            at {formatTime(booking.startTime)}.
          </p>

          {rescheduleStep === "date" ? (
            <div className="mt-6">
              <BookingCalendar
                selectedDateKey={newDateKey}
                onSelectDateKey={handleSelectNewDate}
              />
            </div>
          ) : (
            newDateKey && (
              <div className="mt-6">
                {slotsLoading && (
                  <p className="py-8 text-center text-ink-soft">
                    Checking available times…
                  </p>
                )}
                {slotsError && !slotsLoading && (
                  <div className="rounded-xl border border-line bg-card p-8 text-center">
                    <p className="font-medium text-red-700">{slotsError}</p>
                    <button
                      type="button"
                      onClick={() => setRetryCount((count) => count + 1)}
                      className="mt-5 rounded-full border border-ink px-5 py-2.5 text-sm font-medium hover:bg-ink hover:text-paper"
                    >
                      Try again
                    </button>
                  </div>
                )}
                {!slotsLoading && !slotsError && slots !== null && slots.length === 0 && (
                  <div className="rounded-xl border border-line bg-card p-8 text-center">
                    <p className="font-medium">No slots left on this day.</p>
                    <button
                      type="button"
                      onClick={() => setRescheduleStep("date")}
                      className="mt-4 rounded-full border border-ink px-5 py-2.5 text-sm font-medium hover:bg-ink hover:text-paper"
                    >
                      Choose another date
                    </button>
                  </div>
                )}
                {!slotsLoading && !slotsError && slots !== null && slots.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {slots.map((slot) => (
                        <TimeSlot
                          key={slot.startTime}
                          label={slot.label}
                          durationMinutes={booking.serviceDurationMinutes}
                          selected={newSlot?.startTime === slot.startTime}
                          onSelect={() => setNewSlot(slot)}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirmReschedule}
                      disabled={!newSlot || busy}
                      className="mt-6 w-full rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busy ? "Rescheduling…" : "Confirm new time"}
                    </button>
                  </>
                )}
              </div>
            )
          )}
        </section>
      )}

      {mode === "cancel" && (
        <section>
          <button
            type="button"
            onClick={() => {
              setMode("view");
              setError(null);
            }}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to appointment
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Are you sure you want to cancel?
          </h1>
          <p className="mt-1.5 text-ink-soft">
            This will free up your time slot for other customers.
          </p>
          <div className="mt-6">
            <BookingSummary booking={booking} />
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={busy}
              className="rounded-full bg-red-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Cancelling…" : "Cancel appointment"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setError(null);
              }}
              className="rounded-full border border-line bg-card px-6 py-3.5 text-base font-medium text-ink-soft hover:text-ink"
            >
              Keep appointment
            </button>
          </div>
        </section>
      )}

      {mode === "view" && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your appointment
          </h1>
          <div className="mt-6">
            <BookingSummary booking={booking} />
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm">
            <span
              className={[
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                isCancelled
                  ? "bg-red-50 text-red-700"
                  : "bg-gold-soft text-gold-strong",
              ].join(" ")}
            >
              {statusLabel(booking.status)}
            </span>
            {booking.previousStartTime && booking.status === "rescheduled" && (
              <span className="text-ink-soft">
                Previously {formatTime(booking.previousStartTime)} on{" "}
                {formatLongDate(booking.previousStartTime)}
              </span>
            )}
          </div>

          {isCancelled ? (
            <div className="mt-8 rounded-xl border border-line bg-card p-5 text-center">
              <p className="font-medium">This appointment has been cancelled.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Need a new time? Book again in under a minute.
              </p>
              <Link
                href="/book"
                className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-base font-semibold text-paper hover:bg-black"
              >
                Book a new appointment
              </Link>
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={startReschedule}
                className="rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper transition-colors hover:bg-black"
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={startCancel}
                className="rounded-full border border-line bg-card px-6 py-3.5 text-base font-medium text-ink-soft transition-colors hover:border-red-300 hover:text-red-600"
              >
                Cancel appointment
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}