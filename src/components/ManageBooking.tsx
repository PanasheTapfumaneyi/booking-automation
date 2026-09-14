"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton, SlowNotice } from "@/components/LoadingState";
import type { Booking, TimeSlot as SlotOption } from "@/types/booking";
import {
  formatTime,
  formatLongDate,
  formatTimeInZone,
  formatLongDateInZone,
  zonedInstant,
  DEFAULT_TIMEZONE,
} from "@/lib/availability";
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

type Mode = "view" | "reschedule" | "cancel" | "cancelled" | "rescheduled" | "rebook";

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

/** Detect booking mode from the booking data. */
function detectMode(booking: Booking): "appointment" | "resource" | "capacity" {
  if (booking.sessionId) return "capacity";
  if (booking.resourceId) return "resource";
  return "appointment";
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

  // Resource reschedule state
  const [resourceNewDate, setResourceNewDate] = useState<string | null>(null);
  const [resourceNewStart, setResourceNewStart] = useState("");
  const [resourceNewEnd, setResourceNewEnd] = useState("");

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
              : "We couldn't load this booking. Please try again.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, retryCount]);

  const bookingMode = booking ? detectMode(booking) : "appointment";
  const canReschedule = bookingMode === "appointment" || bookingMode === "resource";
  const slotsLoading = !slotsError && slotQuery !== null && slots === null;

  useEffect(() => {
    if (!slotQuery || !booking || bookingMode !== "appointment") return;

    let cancelled = false;
    apiGetAvailability({
      serviceId: booking.serviceId,
      businessId: booking.businessId,
      date: slotQuery,
      excludeBookingToken: booking.manageToken,
    })
      .then((availability) => {
        if (cancelled) return;
        if (availability.kind === "appointment") {
          setSlots(availability.slots);
        } else {
          setSlots([]);
        }
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
  }, [slotQuery, booking, retryCount, bookingMode]);

  function startReschedule() {
    setMode("reschedule");
    setRescheduleStep("date");
    setNewDateKey(null);
    setNewSlot(null);
    setSlotQuery(null);
    setSlots(null);
    setSlotsError(null);
    setResourceNewDate(null);
    setResourceNewStart("");
    setResourceNewEnd("");
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
    if (!booking) return;

    if (bookingMode === "resource") {
      if (!resourceNewDate || !resourceNewStart || !resourceNewEnd) return;
      setBusy(true);
      setError(null);
      const tz = booking.businessTimezone ?? DEFAULT_TIMEZONE;
      const startIso = zonedInstant(resourceNewDate, resourceNewStart, tz);
      const endIso = zonedInstant(resourceNewDate, resourceNewEnd, tz);
      apiRescheduleBooking(token, startIso, endIso)
        .then((updated) => {
          setBooking(updated);
          setMode("rescheduled");
        })
        .catch((rescheduleError: unknown) => {
          setMode("view");
          setError(
            rescheduleError instanceof BookingApiError
              ? rescheduleError.message
              : "We couldn't reschedule your booking. Please try again.",
          );
        })
        .finally(() => setBusy(false));
      return;
    }

    // appointment
    if (!newSlot) return;
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
      .finally(() => setBusy(false));
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
            : "We couldn't cancel your booking. Please try again.",
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
          Booking not found
        </h1>
        <p className="mt-2 text-ink-soft">
          We couldn&apos;t find this booking. The link may be incorrect or
          the booking may have been removed.
        </p>
        <Link
          href="/book"
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-base font-semibold text-paper hover:bg-black"
        >
          Book again
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-24">
        {bookingError ? (
          <div className="text-center">
            <p className="text-red-700">{bookingError}</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-4 rounded-full bg-ink px-6 py-3 text-base font-semibold text-paper hover:bg-black"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
            <SlowNotice />
          </div>
        )}
      </div>
    );
  }

  const isCancelled = booking.status === "cancelled";
  const fmtTime = (iso: string) =>
    booking.businessTimezone ? formatTimeInZone(iso, booking.businessTimezone) : formatTime(iso);
  const fmtDate = (iso: string) =>
    booking.businessTimezone ? formatLongDateInZone(iso, booking.businessTimezone) : formatLongDate(iso);

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
            Booking rescheduled
          </h1>
          <p className="mt-1.5 text-ink-soft">
            Your booking has moved to the new time below.
          </p>
          <div className="mt-8 text-left">
{booking.previousStartTime && (
                <p className="mb-3 flex items-center justify-center gap-3 text-sm text-ink-soft">
                  <s>
                    {fmtDate(booking.previousStartTime)} ·{" "}
                    {fmtTime(booking.previousStartTime)}
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
              View booking
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              Back to home
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
            Booking cancelled
          </h1>
          <p className="mt-1.5 text-ink-soft">
            Your booking has been cancelled. We hope to see you again soon.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/book"
              className="rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper hover:bg-black"
            >
              Book again
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              Back to home
            </Link>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* RESCHEDULE — appointment mode (slot picker)                     */}
      {/* ================================================================ */}
      {mode === "reschedule" && bookingMode === "appointment" && (
        <section>
          <button
            type="button"
            onClick={() => {
              setMode("view");
              setError(null);
            }}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to booking
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose a new time
          </h1>
          <p className="mt-1.5 text-ink-soft">
            {booking.serviceName} · move from {fmtDate(booking.startTime)}{" "}
            at {fmtTime(booking.startTime)}.
          </p>

          {rescheduleStep === "date" ? (
            <div className="mt-6">
              <BookingCalendar
                selectedDateKey={newDateKey}
                onSelectDateKey={handleSelectNewDate}
                timezone={booking.businessTimezone}
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

      {/* ================================================================ */}
      {/* RESCHEDULE — resource mode (date + time picker)                 */}
      {/* ================================================================ */}
      {mode === "reschedule" && bookingMode === "resource" && (
        <section>
          <button
            type="button"
            onClick={() => {
              setMode("view");
              setError(null);
            }}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to booking
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose a new time
          </h1>
          <p className="mt-1.5 text-ink-soft">
            {booking.serviceName} · move from {fmtDate(booking.startTime)}{" "}
            at {fmtTime(booking.startTime)} – {fmtTime(booking.endTime)}.
          </p>

          {rescheduleStep === "date" ? (
            <div className="mt-6">
              <BookingCalendar
                selectedDateKey={resourceNewDate}
                onSelectDateKey={(dateKey) => {
                  setResourceNewDate(dateKey);
                  setResourceNewStart("");
                  setResourceNewEnd("");
                  setRescheduleStep("slot");
                }}
                timezone={booking.businessTimezone}
              />
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="res-start" className="mb-1.5 block text-sm font-medium text-ink">
                    Start time
                  </label>
                  <input
                    id="res-start"
                    type="time"
                    value={resourceNewStart}
                    onChange={(e) => setResourceNewStart(e.target.value)}
                    className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label htmlFor="res-end" className="mb-1.5 block text-sm font-medium text-ink">
                    End time
                  </label>
                  <input
                    id="res-end"
                    type="time"
                    value={resourceNewEnd}
                    onChange={(e) => setResourceNewEnd(e.target.value)}
                    className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-gold"
                  />
                </div>
              </div>
              {resourceNewStart && resourceNewEnd && resourceNewStart >= resourceNewEnd && (
                <p className="mt-2 text-sm text-red-700">End time must be after start time.</p>
              )}
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={
                  !resourceNewStart ||
                  !resourceNewEnd ||
                  resourceNewStart >= resourceNewEnd ||
                  busy
                }
                className="mt-6 w-full rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Rescheduling…" : "Confirm new time"}
              </button>
            </div>
          )}
        </section>
      )}

      {/* ================================================================ */}
      {/* RESCHEDULE — capacity mode (not supported: cancel + rebook)      */}
      {/* ================================================================ */}
      {mode === "reschedule" && bookingMode === "capacity" && (
        <section>
          <button
            type="button"
            onClick={() => {
              setMode("view");
              setError(null);
            }}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to booking
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Reschedule not available
          </h1>
          <p className="mt-1.5 text-ink-soft">
            Session bookings can&apos;t be rescheduled directly. Cancel this
            booking and book a new session.
          </p>
          <div className="mt-6">
            <BookingSummary booking={booking} />
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/book"
              className="rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper hover:bg-black"
            >
              Book a new session
            </Link>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setError(null);
              }}
              className="rounded-full border border-line bg-card px-6 py-3.5 text-base font-medium text-ink-soft hover:text-ink"
            >
              Go back
            </button>
          </div>
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
            ‹ Back to booking
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Are you sure you want to cancel?
          </h1>
          <p className="mt-1.5 text-ink-soft">
            This will free up your spot for other customers.
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
              {busy ? "Cancelling…" : "Cancel booking"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setError(null);
              }}
              className="rounded-full border border-line bg-card px-6 py-3.5 text-base font-medium text-ink-soft hover:text-ink"
            >
              Keep booking
            </button>
          </div>
        </section>
      )}

      {mode === "view" && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your booking
          </h1>
          <div className="mt-6">
            <BookingSummary booking={booking} />
            {bookingMode === "capacity" && booking.quantity > 1 && (
              <p className="mt-2 text-sm text-ink-soft">
                × {booking.quantity} guest{booking.quantity === 1 ? "" : "s"}
              </p>
            )}
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
                Previously {fmtTime(booking.previousStartTime)} on{" "}
                {fmtDate(booking.previousStartTime)}
              </span>
            )}
          </div>

          {isCancelled ? (
            <div className="mt-8 rounded-xl border border-line bg-card p-5 text-center">
              <p className="font-medium">This booking has been cancelled.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Need to book again? It only takes a moment.
              </p>
              <Link
                href="/book"
                className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-base font-semibold text-paper hover:bg-black"
              >
                Book again
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-8 flex flex-col gap-3">
                {canReschedule && (
                  <button
                    type="button"
                    onClick={startReschedule}
                    className="rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper transition-colors hover:bg-black"
                  >
                    Reschedule
                  </button>
                )}
                {bookingMode === "capacity" && !isCancelled && (
                  <Link
                    href="/book"
                    className="rounded-full bg-ink px-6 py-3.5 text-center text-base font-semibold text-paper transition-colors hover:bg-black"
                  >
                    Book a different session
                  </Link>
                )}
                <button
                  type="button"
                  onClick={startCancel}
                  className="rounded-full border border-line bg-card px-6 py-3.5 text-base font-medium text-ink-soft transition-colors hover:border-red-300 hover:text-red-600"
                >
                  Cancel booking
                </button>
              </div>

              {/* Add to calendar */}
              <div className="mt-4 rounded-xl border border-line bg-paper p-4">
                <p className="text-sm font-medium text-ink">Add to your calendar</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={`/api/bookings/${token}/calendar`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-line-strong hover:text-ink"
                  >
                    Download .ics
                  </a>
                  <a
                    href={`/api/bookings/${token}/calendar?google=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-line-strong hover:text-ink"
                  >
                    Google Calendar
                  </a>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}