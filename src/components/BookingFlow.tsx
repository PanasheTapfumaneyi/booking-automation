"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  Booking,
  BookingMode,
  BookingSession,
  NewBookingInput,
  Resource,
  Service,
  TimeSlot as SlotOption,
} from "@/types/booking";
import type { BusinessHours } from "@/lib/availability";
import { DEMO_SERVICES, DEMO_BUSINESS } from "@/lib/demo";
import {
  apiCreateBooking,
  apiGetAvailability,
  BookingApiError,
} from "@/lib/booking-api";
import ServiceCard from "@/components/ServiceCard";
import BookingCalendar from "@/components/BookingCalendar";
import TimeSlot from "@/components/TimeSlot";
import BookingForm, { type BookingFormValues } from "@/components/BookingForm";
import BookingSummary from "@/components/BookingSummary";

// ---------------------------------------------------------------------------
// Step machine — mode-aware
// ---------------------------------------------------------------------------

type AppointmentStep = "service" | "date" | "time" | "details" | "confirmation";
type ResourceStep = "service" | "resource" | "date" | "time" | "details" | "confirmation";
type CapacityStep = "service" | "session" | "quantity" | "details" | "confirmation";
type Step = AppointmentStep | ResourceStep | CapacityStep;

const APPOINTMENT_STEPS: AppointmentStep[] = ["service", "date", "time", "details"];
const RESOURCE_STEPS: ResourceStep[] = ["service", "resource", "date", "time", "details"];
const CAPACITY_STEPS: CapacityStep[] = ["service", "session", "quantity", "details"];

const STEP_LABELS: Record<string, string> = {
  service: "Service",
  resource: "Item",
  session: "Session",
  date: "Date",
  time: "Time",
  quantity: "Guests",
  details: "Your details",
  confirmation: "Done",
};

// ---------------------------------------------------------------------------
// Props + catalog
// ---------------------------------------------------------------------------

interface BookingFlowProps {
  businessSlug?: string;
}

interface Catalog {
  business: {
    id: string;
    name: string;
    timezone: string;
    hours: BusinessHours | null;
    bookingMode: BookingMode;
  };
  services: Service[];
  resources: Resource[];
  sessions: BookingSession[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BookingFlow({ businessSlug }: BookingFlowProps = {}) {
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(
    businessSlug
      ? null
      : {
          business: {
            id: DEMO_BUSINESS.id,
            name: DEMO_BUSINESS.name,
            timezone: DEMO_BUSINESS.timezone,
            hours: null,
            bookingMode: "appointment",
          },
          services: DEMO_SERVICES,
          resources: [],
          sessions: [],
        },
  );
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Appointment state
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [slotQuery, setSlotQuery] = useState<{ serviceId: string; dateKey: string } | null>(null);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Resource state
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [resourceDateKey, setResourceDateKey] = useState<string | null>(null);
  const [resourceStartTime, setResourceStartTime] = useState("");
  const [resourceEndTime, setResourceEndTime] = useState("");

  // Capacity state
  const [selectedSession, setSelectedSession] = useState<BookingSession | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Shared state
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const mode = catalog?.business.bookingMode ?? "appointment";
  const steps =
    mode === "resource"
      ? RESOURCE_STEPS
      : mode === "capacity"
        ? CAPACITY_STEPS
        : APPOINTMENT_STEPS;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // -----------------------------------------------------------------------
  // Load catalog
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!businessSlug) return;
    let cancelled = false;
    fetch(`/api/public/businesses/${encodeURIComponent(businessSlug)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.status === 404 ? "not-found" : "unavailable");
        }
        return response.json() as Promise<{
          business: {
            id: string;
            name: string;
            timezone: string;
            hours: BusinessHours | null;
            booking_mode: BookingMode;
          };
          services: Array<{
            id: string;
            businessId: string;
            name: string;
            durationMinutes: number;
            price: number;
          }>;
          resources: Array<{ id: string; name: string; resource_type: string }>;
          sessions: Array<{
            id: string;
            service_id: string;
            start_time: string;
            end_time: string | null;
            capacity: number;
            booked: number;
            remaining: number;
            active: boolean;
            service?: { name: string } | null;
          }>;
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setCatalog({
          business: {
            id: data.business.id,
            name: data.business.name,
            timezone: data.business.timezone,
            hours: data.business.hours ?? null,
            bookingMode: data.business.booking_mode,
          },
          services: data.services.map((s) => ({
            ...s,
            description: "",
            active: true,
          })),
          resources: data.resources.map((r) => ({
            id: r.id,
            businessId: data.business.id,
            name: r.name,
            resourceType: r.resource_type,
            active: true,
            imageUrl: null,
            metadata: {},
          })),
          sessions: data.sessions.map((s) => ({
            id: s.id,
            businessId: data.business.id,
            serviceId: s.service_id,
            startTime: s.start_time,
            endTime: s.end_time,
            capacity: s.capacity,
            active: s.active,
            booked: s.booked,
            remaining: s.remaining,
          })),
        });
        setCatalogError(null);
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        setCatalogError(
          fetchError instanceof Error && fetchError.message === "not-found"
            ? "We couldn't find this business. The link may be incorrect."
            : "We couldn't load this business right now. Please try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [businessSlug]);

  // -----------------------------------------------------------------------
  // Load appointment slots (appointment mode only)
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!slotQuery || mode !== "appointment") return;
    let cancelled = false;
    apiGetAvailability({
      serviceId: slotQuery.serviceId,
      date: slotQuery.dateKey,
      businessId: catalog?.business.id,
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
  }, [slotQuery, retryCount, catalog?.business.id, mode]);

  // -----------------------------------------------------------------------
  // Navigation helpers
  // -----------------------------------------------------------------------

  function selectStep(next: Step) {
    setError(null);
    setStep(next);
  }

  function currentStepIndex(): number {
    return steps.indexOf(step as never);
  }

  // -----------------------------------------------------------------------
  // Service selection (all modes)
  // -----------------------------------------------------------------------

  function handleSelectService(nextService: Service) {
    setService(nextService);
    setError(null);
    if (mode === "capacity") {
      setStep("session");
    } else if (mode === "resource") {
      setStep("resource");
    } else {
      setStep("date");
    }
  }

  // -----------------------------------------------------------------------
  // Appointment mode handlers
  // -----------------------------------------------------------------------

  function handleSelectDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setSelectedSlot(null);
    setSlots(null);
    setSlotsError(null);
    if (service) {
      setSlotQuery((current) => {
        if (current?.serviceId === service.id && current.dateKey === dateKey) {
          return { ...current };
        }
        return { serviceId: service.id, dateKey };
      });
    }
    setError(null);
    setStep("time");
  }

  function handleSelectSlot(slot: SlotOption) {
    setSelectedSlot(slot);
    setError(null);
    setStep("details");
  }

  // -----------------------------------------------------------------------
  // Resource mode handlers
  // -----------------------------------------------------------------------

  function handleSelectResource(resource: Resource) {
    setSelectedResource(resource);
    setError(null);
    setStep("date");
  }

  function handleSelectResourceDate(dateKey: string) {
    setResourceDateKey(dateKey);
    setResourceStartTime("");
    setResourceEndTime("");
    setError(null);
    setStep("time");
  }

  // -----------------------------------------------------------------------
  // Capacity mode handlers
  // -----------------------------------------------------------------------

  function handleSelectSession(session: BookingSession) {
    setSelectedSession(session);
    setQuantity(1);
    setError(null);
    setStep("quantity");
  }

  // -----------------------------------------------------------------------
  // Submit (all modes)
  // -----------------------------------------------------------------------

  function handleSubmitDetails(values: BookingFormValues) {
    if (!service) {
      setError("Something went wrong. Please start again.");
      setStep("service");
      return;
    }

    let input: NewBookingInput;

    if (mode === "appointment") {
      if (!selectedSlot) {
        setError("Something went wrong. Please start again.");
        setStep("service");
        return;
      }
      input = {
        serviceId: service.id,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        name: values.name,
        phone: values.phone,
        email: values.email,
      };
    } else if (mode === "resource") {
      if (!selectedResource || !resourceStartTime || !resourceEndTime) {
        setError("Something went wrong. Please start again.");
        setStep("service");
        return;
      }
      // Build ISO timestamps from date + time in the business timezone
      const startIso = buildIsoFromDateTime(resourceDateKey!, resourceStartTime, catalog!.business.timezone);
      const endIso = buildIsoFromDateTime(resourceDateKey!, resourceEndTime, catalog!.business.timezone);
      input = {
        serviceId: service.id,
        startTime: startIso,
        endTime: endIso,
        name: values.name,
        phone: values.phone,
        email: values.email,
        resourceId: selectedResource.id,
      };
    } else {
      // capacity
      if (!selectedSession) {
        setError("Something went wrong. Please start again.");
        setStep("service");
        return;
      }
      input = {
        serviceId: service.id,
        startTime: selectedSession.startTime,
        endTime: selectedSession.endTime ?? selectedSession.startTime,
        name: values.name,
        phone: values.phone,
        email: values.email,
        sessionId: selectedSession.id,
        quantity,
      };
    }

    setCreating(true);
    setError(null);

    apiCreateBooking(input)
      .then((created) => {
        setBooking(created);
        setStep("confirmation");
      })
      .catch((createError: unknown) => {
        if (
          createError instanceof BookingApiError &&
          (createError.isSlotUnavailable || createError.isCapacityFull)
        ) {
          setError(createError.message);
          setStep(mode === "capacity" ? "session" : "time");
          return;
        }
        setError(
          createError instanceof BookingApiError
            ? createError.message
            : "We couldn't complete your booking. Please try again.",
        );
      })
      .finally(() => {
        setCreating(false);
      });
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const stepIndex = currentStepIndex();
  const slotsLoading = mode === "appointment" && !slotsError && slotQuery !== null && slots === null;

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-8">
      {/* Step indicator */}
      <nav aria-label="Booking progress" className="mb-8">
        <ol className="flex items-center gap-2 text-xs font-medium">
          {steps.map((item, index) => {
            const done = step === "confirmation" ? true : index < stepIndex;
            const active = step === item;
            return (
              <li key={item} className="flex flex-1 items-center gap-2">
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                    active
                      ? "border-gold bg-gold text-white"
                      : done
                        ? "border-gold bg-gold-soft text-gold-strong"
                        : "border-line bg-card text-ink-soft",
                  ].join(" ")}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={[
                    "hidden sm:inline",
                    active ? "font-semibold text-ink" : "text-ink-soft",
                  ].join(" ")}
                >
                  {STEP_LABELS[item] ?? item}
                </span>
                {index < steps.length - 1 && (
                  <span className="h-px flex-1 bg-line" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* ================================================================ */}
      {/* SERVICE STEP (all modes)                                         */}
      {/* ================================================================ */}
      {step === "service" && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">
            What would you like to book?
          </h1>
          {catalogError ? (
            <p className="mt-6 text-red-700">{catalogError}</p>
          ) : !catalog ? (
            <p className="mt-6 text-ink-soft">Loading services…</p>
          ) : (
            <>
              <p className="mt-1.5 text-ink-soft">
                Choose a service to see what&apos;s available at {catalog.business.name}.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                {catalog.services.map((item) => (
                  <ServiceCard
                    key={item.id}
                    service={item}
                    selected={service?.id === item.id}
                    onSelect={handleSelectService}
                    businessName={catalog.business.name}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* ================================================================ */}
      {/* RESOURCE MODE: resource → date → time → details → confirmation   */}
      {/* ================================================================ */}

      {/* Resource selector */}
      {step === "resource" && (
        <section>
          <button
            type="button"
            onClick={() => selectStep("service")}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to services
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">Choose an item</h1>
          <p className="mt-1.5 text-ink-soft">
            Select what you&apos;d like to book.
          </p>
          {catalog && catalog.resources.length === 0 ? (
            <div className="mt-6 rounded-xl border border-line bg-card p-8 text-center">
              <p className="font-medium">No items available</p>
              <p className="mt-1 text-sm text-ink-soft">
                There are no bookable items right now.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {catalog?.resources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  onClick={() => handleSelectResource(resource)}
                  className={[
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    selectedResource?.id === resource.id
                      ? "border-gold bg-gold-soft"
                      : "border-line bg-card hover:border-gold/50",
                  ].join(" ")}
                >
                  <span className="font-medium">{resource.name}</span>
                  <span className="ml-2 text-sm text-ink-soft">
                    {resource.resourceType}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Resource date */}
      {step === "date" && mode === "resource" && (
        <section>
          <button
            type="button"
            onClick={() => selectStep("resource")}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to items
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">Choose a date</h1>
          <p className="mt-1.5 text-ink-soft">
            {selectedResource?.name} — pick a date.
          </p>
          <div className="mt-6">
            <BookingCalendar
              selectedDateKey={resourceDateKey}
              onSelectDateKey={handleSelectResourceDate}
              hours={catalog?.business.hours ?? null}
            />
          </div>
        </section>
      )}

      {/* Resource time (start + end) */}
      {step === "time" && mode === "resource" && resourceDateKey && (
        <section>
          <button
            type="button"
            onClick={() => selectStep("date")}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to dates
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Pick-up and return times
          </h1>
          <p className="mt-1.5 text-ink-soft">
            {selectedResource?.name} · {formatSelectedDate(resourceDateKey)}
          </p>

          <div className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="start-time" className="mb-1.5 block text-sm font-medium text-ink">
                Start time
              </label>
              <input
                id="start-time"
                type="time"
                value={resourceStartTime}
                onChange={(e) => setResourceStartTime(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-gold"
              />
            </div>
            <div>
              <label htmlFor="end-time" className="mb-1.5 block text-sm font-medium text-ink">
                End time
              </label>
              <input
                id="end-time"
                type="time"
                value={resourceEndTime}
                onChange={(e) => setResourceEndTime(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-gold"
              />
            </div>
          </div>

          {resourceStartTime && resourceEndTime && resourceStartTime >= resourceEndTime && (
            <p className="mt-2 text-sm text-red-700">End time must be after start time.</p>
          )}

          <button
            type="button"
            disabled={!resourceStartTime || !resourceEndTime || resourceStartTime >= resourceEndTime}
            onClick={() => {
              setError(null);
              setStep("details");
            }}
            className="mt-6 w-full rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-black disabled:opacity-40"
          >
            Continue
          </button>
        </section>
      )}

      {/* ================================================================ */}
      {/* CAPACITY MODE: session → quantity → details → confirmation       */}
      {/* ================================================================ */}

      {/* Session selector */}
      {step === "session" && (
        <section>
          <button
            type="button"
            onClick={() => selectStep("service")}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to services
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">Choose a session</h1>
          <p className="mt-1.5 text-ink-soft">
            Select a session to book your spots.
          </p>

          {catalog && catalog.sessions.length === 0 ? (
            <div className="mt-6 rounded-xl border border-line bg-card p-8 text-center">
              <p className="font-medium">No upcoming sessions</p>
              <p className="mt-1 text-sm text-ink-soft">
                Check back later for available sessions.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {catalog?.sessions.map((session) => {
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleSelectSession(session)}
                    disabled={session.remaining <= 0}
                    className={[
                      "w-full rounded-xl border p-4 text-left transition-colors",
                      session.remaining <= 0
                        ? "opacity-50 cursor-not-allowed border-line bg-card"
                        : selectedSession?.id === session.id
                          ? "border-gold bg-gold-soft"
                          : "border-line bg-card hover:border-gold/50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">
                          {formatSessionDate(session.startTime)}
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                          {formatSessionTime(session.startTime)}
                          {session.endTime
                            ? ` – ${formatSessionTime(session.endTime)}`
                            : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-ink-soft">
                        {session.remaining <= 0
                          ? "Full"
                          : `${session.remaining} spot${session.remaining === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Quantity selector */}
      {step === "quantity" && selectedSession && (
        <section>
          <button
            type="button"
            onClick={() => selectStep("session")}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to sessions
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">How many guests?</h1>
          <p className="mt-1.5 text-ink-soft">
            {formatSessionDate(selectedSession.startTime)} ·{" "}
            {formatSessionTime(selectedSession.startTime)}
          </p>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-medium hover:border-gold"
            >
              −
            </button>
            <span className="w-12 text-center text-2xl font-semibold">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-medium hover:border-gold"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep("details");
            }}
            className="mt-6 w-full rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-black"
          >
            Continue
          </button>
        </section>
      )}

      {/* ================================================================ */}
      {/* APPOINTMENT MODE: date → time → details → confirmation          */}
      {/* ================================================================ */}

      {step === "date" && mode === "appointment" && service && (
        <section>
          <button
            type="button"
            onClick={() => selectStep("service")}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to services
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">Choose a date</h1>
          <p className="mt-1.5 text-ink-soft">
            {service.name} — pick any open day in the next 30 days.
          </p>
          <div className="mt-6">
            <BookingCalendar
              selectedDateKey={selectedDateKey}
              onSelectDateKey={handleSelectDate}
              hours={catalog?.business.hours ?? null}
            />
          </div>
        </section>
      )}

      {step === "time" && mode === "appointment" && service && selectedDateKey && (
        <section>
          <button
            type="button"
            onClick={() => selectStep("date")}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to dates
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">Available times</h1>
          <p className="mt-1.5 text-ink-soft">{formatSelectedDate(selectedDateKey)}</p>

          {slotsLoading && (
            <div className="mt-6 rounded-xl border border-line bg-card p-8 text-center text-ink-soft">
              Checking available times…
            </div>
          )}

          {slotsError && !slotsLoading && (
            <div className="mt-6 rounded-xl border border-line bg-card p-8 text-center">
              <p className="font-medium text-red-700">{slotsError}</p>
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="mt-5 rounded-full border border-ink px-5 py-2.5 text-sm font-medium hover:bg-ink hover:text-paper"
              >
                Try again
              </button>
            </div>
          )}

          {!slotsLoading && !slotsError && slots !== null && slots.length === 0 && (
            <div className="mt-6 rounded-xl border border-line bg-card p-8 text-center">
              <p className="font-medium">No slots left on this day.</p>
              <p className="mt-1 text-sm text-ink-soft">Please pick another date.</p>
              <button
                type="button"
                onClick={() => selectStep("date")}
                className="mt-5 rounded-full border border-ink px-5 py-2.5 text-sm font-medium hover:bg-ink hover:text-paper"
              >
                Choose another date
              </button>
            </div>
          )}

          {!slotsLoading && !slotsError && slots !== null && slots.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {slots.map((slot) => (
                <TimeSlot
                  key={slot.startTime}
                  label={slot.label}
                  durationMinutes={service.durationMinutes}
                  selected={selectedSlot?.startTime === slot.startTime}
                  onSelect={() => handleSelectSlot(slot)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================================================================ */}
      {/* DETAILS STEP (all modes)                                         */}
      {/* ================================================================ */}
      {step === "details" && service && (
        <section>
          <button
            type="button"
            onClick={() => {
              if (mode === "appointment") selectStep("time");
              else if (mode === "resource") selectStep("time");
              else selectStep("quantity");
            }}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">Your details</h1>
          <p className="mt-1.5 text-ink-soft">
            We only need what we need to confirm your booking.
          </p>
          <div className="mb-6 mt-6">
            <BookingSummary
              booking={buildSummaryBooking()}
              showPrice={mode !== "capacity" || quantity <= 1}
            />
            {mode === "capacity" && quantity > 1 && (
              <p className="mt-2 text-sm text-ink-soft">
                × {quantity} guests
              </p>
            )}
          </div>
          <BookingForm
            onSubmit={handleSubmitDetails}
            disabled={creating}
            submitLabel={creating ? "Booking…" : "Confirm booking"}
          />
        </section>
      )}

      {/* ================================================================ */}
      {/* CONFIRMATION (all modes)                                        */}
      {/* ================================================================ */}
      {step === "confirmation" && booking && (
        <section className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold text-white">
            <span className="text-2xl font-bold">✓</span>
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Booking confirmed
          </h1>
          <p className="mt-1.5 text-ink-soft">
            You will receive a confirmation shortly.
          </p>

          <div className="mt-8 text-left">
            <BookingSummary booking={booking} />
            {mode === "capacity" && booking.quantity > 1 && (
              <p className="mt-2 text-sm text-ink-soft">
                × {booking.quantity} guests
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/manage/${booking.manageToken}`}
              className="rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper transition-colors hover:bg-black"
            >
              Manage booking
            </Link>
            <button
              type="button"
              onClick={() => {
                setBooking(null);
                setService(null);
                setSelectedDateKey(null);
                setSelectedSlot(null);
                setSelectedResource(null);
                setResourceDateKey(null);
                setResourceStartTime("");
                setResourceEndTime("");
                setSelectedSession(null);
                setQuantity(1);
                setSlotQuery(null);
                setSlots(null);
                setStep("service");
              }}
              className="rounded-full border border-line bg-card px-6 py-3.5 text-base font-medium text-ink-soft hover:text-ink"
            >
              Book another
            </button>
          </div>

          {/* Add to calendar */}
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm font-medium text-ink">Add to your calendar</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/bookings/${booking.manageToken}/calendar`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                Download .ics
              </a>
              <a
                href={`/api/bookings/${booking.manageToken}/calendar?google=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
              >
                Google Calendar
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function buildSummaryBooking() {
    if (mode === "resource" && selectedResource) {
      return {
        serviceName: `${service!.name} — ${selectedResource.name}`,
        startTime: buildIsoFromDateTime(resourceDateKey!, resourceStartTime, catalog!.business.timezone),
        endTime: buildIsoFromDateTime(resourceDateKey!, resourceEndTime, catalog!.business.timezone),
        servicePrice: service!.price,
        serviceDurationMinutes: 0,
      };
    }
    if (mode === "capacity" && selectedSession) {
      return {
        serviceName: service!.name,
        startTime: selectedSession.startTime,
        endTime: selectedSession.endTime ?? selectedSession.startTime,
        servicePrice: service!.price * quantity,
        serviceDurationMinutes: 0,
      };
    }
    // appointment
    return {
      serviceName: service!.name,
      startTime: selectedSlot!.startTime,
      endTime: selectedSlot!.endTime,
      servicePrice: service!.price,
      serviceDurationMinutes: service!.durationMinutes,
    };
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatSelectedDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-MU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-MU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

/**
 * Build an ISO timestamp from a YYYY-MM-DD date key and HH:MM time string
 * in the given IANA timezone. Uses the same zonedInstant approach as the
 * server-side resource booking form.
 */
function buildIsoFromDateTime(dateKey: string, time: string, timezone: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  // Format as a datetime string in the target timezone, then parse as UTC
  // to get the correct instant. This avoids DST ambiguity.
  const dt = new Date(
    Date.UTC(year, month - 1, day, hours, minutes, 0, 0),
  );
  // Adjust for timezone offset: format in target tz, get the offset, adjust
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(dt);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const tzYear = Number(get("year"));
  const tzMonth = Number(get("month"));
  const tzDay = Number(get("day"));
  const tzHour = Number(get("hour"));
  const tzMinute = Number(get("minute"));
  // The UTC time we want is: desired local time - timezone offset
  // We compute offset by comparing UTC representation with local representation
  const tzAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0, 0);
  const offset = tzAsUtc - dt.getTime();
  return new Date(dt.getTime() - offset).toISOString();
}
