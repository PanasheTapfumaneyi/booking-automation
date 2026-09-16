"use client";

import { useEffect, useRef, useState } from "react";
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
import { clampQuantity, DEFAULT_TIMEZONE } from "@/lib/availability";
import { DEMO_SERVICES, DEMO_BUSINESS } from "@/lib/demo";
import {
  apiCreateBooking,
  apiGetAvailability,
  type ResourceAvailability,
  type DispatchSummary,
  BookingApiError,
} from "@/lib/booking-api";
import {
  rentalEnablementReasons,
  pickPreselectedVehicle,
} from "@/lib/rental-flow";
import {
  readUnitRate,
  rentalDays,
  computeResourceTotal,
  formatMauritianRupees,
} from "@/lib/resource-pricing";
import ServiceCard from "@/components/ServiceCard";
import { ServiceListSkeleton, SlowNotice } from "@/components/LoadingState";
import BookingCalendar from "@/components/BookingCalendar";
import TimeSlot from "@/components/TimeSlot";
import BookingForm, { type BookingFormValues } from "@/components/BookingForm";
import BookingSummary from "@/components/BookingSummary";
import { trackFunnelEvent, getAttemptId } from "@/lib/tracking";

// ---------------------------------------------------------------------------
// Step machine — mode-aware
// ---------------------------------------------------------------------------

type AppointmentStep = "service" | "date" | "time" | "details" | "confirmation";
type ResourceStep = "service" | "resource" | "date" | "time" | "details" | "confirmation";
type RentalStep = "dates" | "fleet" | "details" | "confirmation";
type CapacityStep = "service" | "session" | "quantity" | "details" | "confirmation";
type Step = AppointmentStep | ResourceStep | RentalStep | CapacityStep;

const APPOINTMENT_STEPS: AppointmentStep[] = ["service", "date", "time", "details"];
const RESOURCE_STEPS: ResourceStep[] = ["service", "resource", "date", "time", "details"];
const RENTAL_STEPS: RentalStep[] = ["dates", "fleet", "details"];
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
  dates: "Dates",
  fleet: "Vehicle",
};

// Mode-aware resource copy labels.
// Derives vocabulary from the resources already loaded in the catalog:
// if all active resources have resourceType "vehicle", use car-specific
// language. Otherwise fall back to neutral item language.
// This keeps the booking engine untouched — only copy changes.
function isVehicleMode(resources: Array<{ resourceType: string }>): boolean {
  if (resources.length === 0) return false;
  return resources.every((r) => r.resourceType === "vehicle");
}

function resourceLabel(
  resources: Array<{ resourceType: string }>,
  key: "item" | "start" | "end",
): string {
  if (isVehicleMode(resources)) {
    if (key === "item") return "Vehicle";
    if (key === "start") return "Pick-up";
    return "Return";
  }
  if (key === "item") return "Equipment / Item";
  if (key === "start") return "Start";
  return "Return";
}

function datesHeading(resources: Array<{ resourceType: string }>): string {
  if (isVehicleMode(resources)) return "Pick-up & return";
  return "Start & end dates";
}

function availabilitySearchLabel(resources: Array<{ resourceType: string }>): string {
  if (isVehicleMode(resources)) return "Search available vehicles";
  return "Search available items";
}

// ---------------------------------------------------------------------------
// Props + catalog
// ---------------------------------------------------------------------------

interface BookingFlowProps {
  businessSlug?: string;
  /** Optional vehicle preselect via `?vehicle=<id>` from the business page. */
  initialVehicleId?: string;
  /** Optional service preselect via `?service=<id>` (appointment mode). */
  initialServiceId?: string;
}

interface Catalog {
  business: {
    id: string;
    name: string;
    phone: string | null;
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

function confirmationWording(summary: DispatchSummary | null): string {
  if (!summary || !summary.dispatched) {
    return "This page is your booking confirmation.";
  }
  if (summary.recipients.customer === "sent") {
    return "A confirmation has been sent to your phone.";
  }
  return "This page is your booking confirmation.";
}

export default function BookingFlow({
  businessSlug,
  initialVehicleId,
  initialServiceId,
}: BookingFlowProps = {}) {
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(
    businessSlug
      ? null
      : {
          business: {
            id: DEMO_BUSINESS.id,
            name: DEMO_BUSINESS.name,
            phone: null,
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
  const [catalogRetry, setCatalogRetry] = useState(0);

  // Resource state
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [resourceDateKey, setResourceDateKey] = useState<string | null>(null);
  const [resourceStartTime, setResourceStartTime] = useState("");
  const [resourceEndTime, setResourceEndTime] = useState("");

  // Rental (multi-day resource) state
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [rentalRange, setRentalRange] = useState<{ startIso: string; endIso: string } | null>(null);
  const [rentalResults, setRentalResults] = useState<ResourceAvailability | null>(null);
  const [rentalLoading, setRentalLoading] = useState(false);
  const [preselectedUsed, setPreselectedUsed] = useState(false);
  // Service deep-link guard: a ref (not state) so consuming it never
  // retriggers the catalog fetch.
  const servicePreselectedRef = useRef(false);

  // Capacity state
  const [selectedSession, setSelectedSession] = useState<BookingSession | null>(null);
  const [quantity, setQuantity] = useState(1);
  const quantityRemaining = selectedSession?.remaining ?? 0;

  // Shared state
  const [booking, setBooking] = useState<Booking | null>(null);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const mode = catalog?.business.bookingMode ?? "appointment";
  // Every resource-mode business books an item over a date/time interval
  // (pickup + return). Unit-rated fleets price by days × rate; non-unit rated
  // resources (surf boards, hourly items) fall back to the service price.
  const isRental = mode === "resource";
  const steps =
    mode === "resource"
      ? isRental
        ? RENTAL_STEPS
        : RESOURCE_STEPS
      : mode === "capacity"
        ? CAPACITY_STEPS
        : APPOINTMENT_STEPS;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // Track when the user reaches the customer details step.
  useEffect(() => {
    if (step === "details") {
      trackFunnelEvent({
        eventName: "customer_details_started",
        businessId: service?.businessId,
      });
    }
  }, [step, service?.businessId]);

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
            phone: string | null;
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
          resources: Array<{
            id: string;
            name: string;
            resource_type: string;
            image_url: string | null;
            metadata: Record<string, unknown> | null;
          }>;
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
            phone: data.business.phone ?? null,
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
            imageUrl: r.image_url ?? null,
            metadata: (r.metadata ?? {}) as Record<string, unknown>,
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

        // Track page view (fire-and-forget).
        trackFunnelEvent({
          eventName: "business_page_viewed",
          businessId: data.business.id,
        });

        // Resource mode: auto-select the single rental service and land on the
        // availability search (no separate service picker needed).
        const rentalService = data.services[0];
        if (
          data.business.booking_mode === "resource" &&
          rentalService &&
          data.resources.length > 0
        ) {
          setService({
            id: rentalService.id,
            businessId: data.business.id,
            name: rentalService.name,
            durationMinutes: rentalService.durationMinutes,
            price: rentalService.price,
            description: "",
            active: true,
          });
          setStep("dates");
        }

        // Appointment mode: preselect the linked service (from the
        // storefront menu) and land on date picking. Unknown ids fall
        // through to the normal service list — never a dead end.
        if (
          data.business.booking_mode === "appointment" &&
          initialServiceId &&
          !servicePreselectedRef.current
        ) {
          const preselected = data.services.find((s) => s.id === initialServiceId);
          if (preselected) {
            setService({
              id: preselected.id,
              businessId: data.business.id,
              name: preselected.name,
              durationMinutes: preselected.durationMinutes,
              price: preselected.price,
              description: "",
              active: true,
            });
            servicePreselectedRef.current = true;
            trackFunnelEvent({
              eventName: "booking_started",
              businessId: data.business.id,
            });
            trackFunnelEvent({
              eventName: "offering_selected",
              businessId: data.business.id,
              metadata: { serviceId: preselected.id, type: "service" },
            });
            setStep("date");
          }
        }
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
  }, [businessSlug, catalogRetry, initialServiceId]);

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
    trackFunnelEvent({
      eventName: "booking_started",
      businessId: nextService.businessId,
    });
    trackFunnelEvent({
      eventName: "offering_selected",
      businessId: nextService.businessId,
      metadata: { serviceId: nextService.id, type: "service" },
    });
    if (mode === "capacity") {
      setStep("session");
    } else if (mode === "resource") {
      setStep("dates");
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
    trackFunnelEvent({
      eventName: "date_selected",
      businessId: service?.businessId,
      metadata: { dateKey },
    });
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
    trackFunnelEvent({
      eventName: "time_selected",
      businessId: service?.businessId,
      metadata: { slotStart: slot.startTime },
    });
    setStep("details");
  }

  // -----------------------------------------------------------------------
  // Resource mode handlers
  // -----------------------------------------------------------------------

  function handleSelectResource(resource: Resource) {
    setSelectedResource(resource);
    setError(null);
    trackFunnelEvent({
      eventName: "offering_selected",
      businessId: resource.businessId,
      metadata: { resourceId: resource.id, type: "resource" },
    });
    setStep("date");
  }

  function handleSelectResourceDate(dateKey: string) {
    setResourceDateKey(dateKey);
    setResourceStartTime("");
    setResourceEndTime("");
    setError(null);
    trackFunnelEvent({
      eventName: "date_selected",
      businessId: service?.businessId,
      metadata: { dateKey, mode: "resource" },
    });
    setStep("time");
  }

  // -----------------------------------------------------------------------
  // Rental mode handlers (multi-day resource)
  // -----------------------------------------------------------------------

  function handleCheckRentalDates() {
    if (!service || !pickupDate || !pickupTime || !returnDate || !returnTime) {
      setError("Please choose pick-up and return dates and times.");
      return;
    }
    const startIso = buildIsoFromDateTime(pickupDate, pickupTime, catalog!.business.timezone);
    const endIso = buildIsoFromDateTime(returnDate, returnTime, catalog!.business.timezone);
    if (endIso <= startIso) {
      setError("Return date and time must be after pick-up.");
      return;
    }
    setRentalRange({ startIso, endIso });
    setRentalResults(null);
    setRentalLoading(true);
    setError(null);
    apiGetAvailability({
      serviceId: service.id,
      date: pickupDate,
      businessId: catalog?.business.id,
      rangeStart: startIso,
      rangeEnd: endIso,
    })
      .then((availability) => {
        const results =
          availability.kind === "resource" ? availability : null;
        setRentalResults(results);
        if (!results) {
          setStep("fleet");
          return;
        }
        // Deep link from the business page (?vehicle=<id>): when the target
        // vehicle is free for the chosen dates, preselect it and skip to the
        // details step. Otherwise land on the fleet grid for a manual pick.
        if (!preselectedUsed && initialVehicleId) {
          const matched = pickPreselectedVehicle(
            results.resources,
            initialVehicleId,
          );
          if (matched) {
            setSelectedResource({
              id: matched.id,
              businessId: catalog!.business.id,
              name: matched.name,
              resourceType: matched.resourceType,
              active: true,
              imageUrl: matched.imageUrl,
              metadata: matched.metadata,
            });
            setPreselectedUsed(true);
            setStep("details");
            return;
          }
        }
        setStep("fleet");
      })
      .catch((searchError: unknown) => {
        setError(
          searchError instanceof BookingApiError
            ? searchError.message
            : "We couldn't check availability. Please try again.",
        );
      })
      .finally(() => {
        setRentalLoading(false);
      });
  }

  function handleSelectRentalResource(resource: Resource) {
    setSelectedResource(resource);
    setError(null);
    setStep("details");
  }

  // -----------------------------------------------------------------------
  // Capacity mode handlers
  // -----------------------------------------------------------------------

  function handleSelectSession(session: BookingSession) {
    setSelectedSession(session);
    setQuantity(1);
    setError(null);
    trackFunnelEvent({
      eventName: "offering_selected",
      businessId: session.businessId,
      metadata: { sessionId: session.id, type: "session" },
    });
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
      if (!selectedResource || !rentalRange) {
        setError("Something went wrong. Please start again.");
        setStep("dates");
        return;
      }
      input = {
        serviceId: service.id,
        startTime: rentalRange.startIso,
        endTime: rentalRange.endIso,
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
        setBooking(created.booking);
        setConfirmationNotice(confirmationWording(created.notifications));
        setStep("confirmation");
      })
      .catch((createError: unknown) => {
        if (
          createError instanceof BookingApiError &&
          (createError.isSlotUnavailable || createError.isCapacityFull)
        ) {
          setError(createError.message);
          setStep(
            mode === "capacity" ? "session" : isRental ? "fleet" : "time",
          );
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

  const rentalValidation = rentalEnablementReasons({
    pickupDate,
    pickupTime,
    returnDate,
    returnTime,
  });
  const rentalSearchDisabled = rentalValidation.length > 0;

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-8">
      {/* Step indicator */}
      <nav aria-label="Booking progress" className="mb-8">
        <ol className="flex items-center gap-2 text-xs font-medium">
          {steps.map((item, index) => {
            const done = step === "confirmation" ? true : index < stepIndex;
            const active = step === item;
            return (
              <li key={item} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] transition-colors",
                    active
                      ? "border-blue bg-blue text-white"
                      : done
                        ? "border-blue/40 bg-blue-soft text-blue-strong"
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

      {/* Step content animates subtly on step change (key remount).
          Short 220ms entrance; collapsed under prefers-reduced-motion. */}
      <div key={step} className="animate-step-in">
      {/* ================================================================ */}
      {/* SERVICE STEP (all modes)                                         */}
      {/* ================================================================ */}
      {step === "service" && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">
            What would you like to book?
          </h1>
          {catalogError ? (
            <div className="mt-6">
              <p className="text-red-700">{catalogError}</p>
              <button
                type="button"
                onClick={() => setCatalogRetry((count) => count + 1)}
                className="mt-3 rounded-full bg-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-strong"
              >
                Retry
              </button>
            </div>
          ) : !catalog ? (
            <div className="mt-6">
              <ServiceListSkeleton />
              <SlowNotice />
            </div>
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
      {/* RENTAL MODE: dates → fleet → details → confirmation             */}
      {/* ================================================================ */}

      {/* Pick-up / return search */}
{step === "dates" && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">
            {datesHeading(catalog?.resources ?? [])}
          </h1>
          <p className="mt-1.5 text-ink-soft">
            {availabilitySearchLabel(catalog?.resources ?? [])} at {catalog?.business.name ?? "this business"}.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="pickup-date" className="mb-1.5 block text-sm font-medium text-ink">
                Pick-up date
              </label>
              <input
                id="pickup-date"
                type="date"
                min={localToday()}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-blue"
              />
              <label htmlFor="pickup-time" className="mb-1.5 mt-4 block text-sm font-medium text-ink">
                Pick-up time
              </label>
              <input
                id="pickup-time"
                type="time"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-blue"
              />
            </div>
            <div>
              <label htmlFor="return-date" className="mb-1.5 block text-sm font-medium text-ink">
                Return date
              </label>
              <input
                id="return-date"
                type="date"
                min={pickupDate || localToday()}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-blue"
              />
              <label htmlFor="return-time" className="mb-1.5 mt-4 block text-sm font-medium text-ink">
                Return time
              </label>
              <input
                id="return-time"
                type="time"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-blue"
              />
            </div>
          </div>

          {rentalValidation.length > 0 && (
            <ul
              role="status"
              className="mt-4 space-y-1 text-sm text-red-700"
              aria-live="polite"
            >
              {rentalValidation.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            disabled={rentalSearchDisabled || rentalLoading}
            onClick={handleCheckRentalDates}
            className="mt-6 w-full rounded-full bg-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-strong disabled:opacity-40"
          >
            {rentalLoading ? "Checking…" : "Check availability"}
          </button>
        </section>
      )}

      {/* Fleet grid */}
      {step === "fleet" && rentalRange && (
        <section>
          <button
            type="button"
            onClick={() => selectStep("dates")}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to dates
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {resourceLabel(catalog?.resources ?? [], "item")}
          </h1>
          <p className="mt-1.5 text-ink-soft">
            {formatSelectedDate(pickupDate)} · {formatRentalTime(pickupTime)} —{" "}
            {formatSelectedDate(returnDate)} · {formatRentalTime(returnTime)}
          </p>

          {rentalLoading && (
            <div className="mt-6 rounded-xl border border-line bg-card p-8 text-center text-ink-soft">
              Checking availability…
            </div>
          )}

          {!rentalLoading && (!rentalResults || rentalResults.kind !== "resource") && (
            <div className="mt-6 rounded-xl border border-line bg-card p-8 text-center text-ink-soft">
              No availability data yet.
            </div>
          )}

          {!rentalLoading &&
            rentalResults?.kind === "resource" &&
            rentalResults.resources.length === 0 && (
              <div className="mt-6 rounded-xl border border-line bg-card p-8 text-center">
                <p className="font-medium">
                  No {resourceLabel(catalog?.resources ?? [], "item").toLowerCase()}s available
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Try adjusting your dates.
                </p>
              </div>
            )}

          {!rentalLoading &&
            rentalResults?.kind === "resource" &&
            rentalResults.resources.length > 0 && (
              <div className="mt-6 grid gap-4">
                {rentalResults.resources.map((vehicle) => {
                  const rate = readUnitRate(vehicle.metadata);
                  const days = rentalDays(rentalRange.startIso, rentalRange.endIso);
                  const total =
                    rate && rate > 0
                      ? formatMauritianRupees(rate * days)
                      : formatMauritianRupees(service!.price);
                  const available = vehicle.available !== false;
                  const specs = vehicle.metadata ?? {};
                  const seats = typeof specs.seats === "number" ? specs.seats : 5;
                  const fuel = typeof specs.fuel === "string" ? specs.fuel : "Petrol";
                  const transmission =
                    typeof specs.transmission === "string" ? specs.transmission : "Automatic";
                  const category =
                    typeof specs.category === "string" ? specs.category : "Car";
                  return (
                    <button
                      key={vehicle.id}
                      type="button"
                      disabled={!available}
                      onClick={() =>
                        handleSelectRentalResource({
                          id: vehicle.id,
                          businessId: catalog!.business.id,
                          name: vehicle.name,
                          resourceType: vehicle.resourceType,
                          active: true,
                          imageUrl: vehicle.imageUrl ?? null,
                          metadata: vehicle.metadata ?? {},
                        })
                        }
                      className={[
                        "w-full overflow-hidden rounded-xl border text-left transition-colors",
                        available
                          ? "border-line bg-card hover:border-blue/60"
                          : "border-line bg-card opacity-55",
                      ].join(" ")}
                    >
                      <div className="relative aspect-[16/8] w-full bg-ink/5">
                        {vehicle.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={vehicle.imageUrl}
                            alt={vehicle.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-ink-soft">
                            {vehicle.name}
                          </div>
                        )}
                        <span
                          className={[
                            "absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold",
                            available ? "bg-emerald-500 text-white" : "bg-ink/70 text-paper",
                          ].join(" ")}
                        >
                          {available ? "Available" : "Unavailable"}
                        </span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{vehicle.name}</p>
                            <p className="mt-0.5 text-sm text-ink-soft">
                              {category} · {transmission} · {seats} seats · {fuel}
                            </p>
                          </div>
                          <p className="text-right text-sm font-semibold">
                            {rate && rate > 0 ? (
                              <>
                                Rs {rate}
                                <span className="block text-xs font-normal text-ink-soft">
                                  / day
                                </span>
                              </>
                            ) : null}
                          </p>
                        </div>
                        {available && (
                          <p className="mt-3 border-t border-line pt-3 text-sm font-medium text-ink">
                            {days} day{days === 1 ? "" : "s"} · {total}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
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
                  aria-label={`${resource.name}, ${resource.resourceType}`}
                  onClick={() => handleSelectResource(resource)}
                  className={[
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    selectedResource?.id === resource.id
                      ? "border-blue bg-blue-mist"
                      : "border-line bg-card hover:border-blue/50",
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
              timezone={catalog?.business.timezone}
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
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-blue"
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
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm outline-none focus:border-blue"
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
            className="mt-6 w-full rounded-full bg-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-strong disabled:opacity-40"
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
                          ? "border-blue bg-blue-mist"
                          : "border-line bg-card hover:border-blue/50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">
                          {formatSessionDate(
                            session.startTime,
                            catalog?.business.timezone ?? DEFAULT_TIMEZONE,
                          )}
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                          {formatSessionTime(
                            session.startTime,
                            catalog?.business.timezone ?? DEFAULT_TIMEZONE,
                          )}
                          {session.endTime
                            ? ` – ${formatSessionTime(
                                session.endTime,
                                catalog?.business.timezone ?? DEFAULT_TIMEZONE,
                              )}`
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
            {formatSessionDate(
              selectedSession.startTime,
              catalog?.business.timezone ?? DEFAULT_TIMEZONE,
            )}{" "}·{" "}
            {formatSessionTime(
              selectedSession.startTime,
              catalog?.business.timezone ?? DEFAULT_TIMEZONE,
            )}
          </p>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              aria-label="Decrease guests"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => clampQuantity(q - 1, quantityRemaining))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-medium hover:border-blue disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <span className="w-12 text-center text-2xl font-semibold" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase guests"
              disabled={quantityRemaining >= 1 && quantity >= quantityRemaining}
              onClick={() => setQuantity((q) => clampQuantity(q + 1, quantityRemaining))}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-medium hover:border-blue disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>

          <p className="mt-3 text-sm text-ink-soft">
            {quantityRemaining > 0
              ? `${quantityRemaining} spot${quantityRemaining === 1 ? "" : "s"} left for this session.`
              : "This session just filled up — please choose another departure."}
          </p>

          <button
            type="button"
            disabled={quantityRemaining < 1}
            onClick={() => {
              setError(null);
              setStep("details");
            }}
            className="mt-6 w-full rounded-full bg-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
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
              timezone={catalog?.business.timezone}
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
                className="mt-5 rounded-full border border-blue/40 px-5 py-2.5 text-sm font-medium text-blue-strong transition-colors hover:bg-blue-mist"
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
                className="mt-5 rounded-full border border-blue/40 px-5 py-2.5 text-sm font-medium text-blue-strong transition-colors hover:bg-blue-mist"
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
              else if (mode === "resource") selectStep(isRental ? "fleet" : "time");
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
              businessName={catalog?.business.name ?? DEMO_BUSINESS.name}
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
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue text-white">
            <span className="text-2xl font-bold">✓</span>
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Booking confirmed
          </h1>
          {confirmationNotice && (
            <p className="mt-1.5 text-ink-soft">{confirmationNotice}</p>
          )}

          <div className="mt-8 text-left">
            <BookingSummary
              booking={booking}
              businessName={catalog?.business.name ?? DEMO_BUSINESS.name}
            />
            {mode === "capacity" && booking.quantity > 1 && (
              <p className="mt-2 text-sm text-ink-soft">
                × {booking.quantity} guests
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/manage/${booking.manageToken}`}
              className="rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong"
            >
              Manage booking
            </Link>
            <button
              type="button"
              onClick={() => {
                setBooking(null);
                setConfirmationNotice(null);
                if (isRental) {
                  setPickupDate("");
                  setPickupTime("");
                  setReturnDate("");
                  setReturnTime("");
                  setRentalRange(null);
                  setRentalResults(null);
                  setSelectedResource(null);
                  setStep("dates");
                  return;
                }
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

          {/* Fallback contact */}
          {catalog?.business.phone && (
            <p className="mt-6 text-sm text-ink-soft">
              Having trouble? Contact{" "}
              <a
                href={`https://wa.me/${catalog.business.phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-ink"
              >
                {catalog.business.name}
              </a>{" "}
              on WhatsApp.
            </p>
          )}
        </section>
      )}
      </div>
    </div>
  );

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function buildSummaryBooking() {
    if (mode === "resource" && isRental && rentalRange && selectedResource) {
      return {
        serviceName: `${service!.name} — ${selectedResource.name}`,
        startTime: rentalRange.startIso,
        endTime: rentalRange.endIso,
        servicePrice: computeResourceTotal({
          metadata: selectedResource.metadata,
          startTime: rentalRange.startIso,
          endTime: rentalRange.endIso,
          fallbackPrice: service!.price,
        }),
        serviceDurationMinutes: 0,
      };
    }
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

/** YYYY-MM-DD for today, in the viewer's local timezone (min for the date picker). */
function localToday(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().split("T")[0];
}

/** Format a "HH:MM" time string as a human-readable 12-hour time. */
function formatRentalTime(time: string): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-MU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSessionDate(iso: string, timezone = DEFAULT_TIMEZONE): string {
  return new Date(iso).toLocaleDateString("en-MU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  });
}

function formatSessionTime(iso: string, timezone = DEFAULT_TIMEZONE): string {
  return new Date(iso).toLocaleTimeString("en-MU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
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
