"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Booking, Service, TimeSlot as SlotOption } from "@/types/booking";
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

type Step = "service" | "date" | "time" | "details" | "confirmation";

const STEP_LABELS: Record<Step, string> = {
  service: "Service",
  date: "Date",
  time: "Time",
  details: "Your details",
  confirmation: "Done",
};

const STEP_ORDER: Step[] = ["service", "date", "time", "details"];

interface SlotQuery {
  serviceId: string;
  dateKey: string;
}

interface BookingFlowProps {
  /** Public business slug for /book/[slug]; omitted → demo business flow. */
  businessSlug?: string;
}

interface Catalog {
  business: { id: string; name: string; timezone: string; hours: BusinessHours | null };
  services: Service[];
}

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
          },
          services: DEMO_SERVICES,
        },
  );
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [slotQuery, setSlotQuery] = useState<SlotQuery | null>(null);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    if (!businessSlug) return;
    let cancelled = false;
    fetch(`/api/public/businesses/${encodeURIComponent(businessSlug)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            response.status === 404 ? "not-found" : "unavailable",
          );
        }
        return response.json() as Promise<{
          business: Catalog["business"];
          services: Array<{
            id: string;
            businessId: string;
            name: string;
            durationMinutes: number;
            price: number;
          }>;
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setCatalog({
          business: data.business,
          services: data.services.map((item) => ({
            ...item,
            description: "",
            active: true,
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

  useEffect(() => {
    if (!slotQuery) return;

    let cancelled = false;
    apiGetAvailability({
      serviceId: slotQuery.serviceId,
      date: slotQuery.dateKey,
      businessId: catalog?.business.id,
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
  }, [slotQuery, retryCount, catalog?.business.id]);

  function selectStep(next: Step) {
    setError(null);
    setStep(next);
  }

  function handleSelectService(nextService: Service) {
    setService(nextService);
    setError(null);
    setStep("date");
  }

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

  function handleSubmitDetails(values: BookingFormValues) {
    if (!service || !selectedSlot) {
      setError("Something went wrong. Please start again.");
      setStep("service");
      return;
    }

    setCreating(true);
    setError(null);

    apiCreateBooking({
      serviceId: service.id,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      name: values.name,
      phone: values.phone,
      email: values.email,
    })
      .then((created) => {
        setBooking(created);
        setStep("confirmation");
      })
      .catch((createError: unknown) => {
        if (createError instanceof BookingApiError && createError.isSlotUnavailable) {
          setError(createError.message);
          setStep("time");
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

  const stepIndex = STEP_ORDER.indexOf(step);
  const slotsLoading = !slotsError && slotQuery !== null && slots === null;

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-8">
      {/* Step indicator */}
      <nav aria-label="Booking progress" className="mb-8">
        <ol className="flex items-center gap-2 text-xs font-medium">
          {STEP_ORDER.map((item, index) => {
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
                  {STEP_LABELS[item]}
                </span>
                {index < STEP_ORDER.length - 1 && (
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
                Choose a service to see available times at {catalog.business.name}.
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

      {step === "date" && service && (
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

      {step === "time" && service && selectedDateKey && (
        <section>
          <button
            type="button"
            onClick={() => selectStep("date")}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to dates
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Available times
          </h1>
          <p className="mt-1.5 text-ink-soft">
            {formatSelectedDate(selectedDateKey)}
          </p>

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
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-5 rounded-full border border-ink px-5 py-2.5 text-sm font-medium hover:bg-ink hover:text-paper"
              >
                Try again
              </button>
            </div>
          )}

          {!slotsLoading && !slotsError && slots !== null && slots.length === 0 && (
            <div className="mt-6 rounded-xl border border-line bg-card p-8 text-center">
              <p className="font-medium">No slots left on this day.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Please pick another date.
              </p>
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

      {step === "details" && service && selectedSlot && (
        <section>
          <button
            type="button"
            onClick={() => selectStep("time")}
            className="mb-5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ‹ Back to times
          </button>
          <h1 className="text-2xl font-semibold tracking-tight">Your details</h1>
          <p className="mt-1.5 text-ink-soft">
            We only need what we need to confirm your appointment.
          </p>
          <div className="mb-6 mt-6">
            <BookingSummary
              booking={{
                serviceName: service.name,
                startTime: selectedSlot.startTime,
                endTime: selectedSlot.endTime,
                servicePrice: service.price,
                serviceDurationMinutes: service.durationMinutes,
              }}
            />
          </div>
          <BookingForm
            onSubmit={handleSubmitDetails}
            disabled={creating}
            submitLabel={creating ? "Booking…" : "Confirm booking"}
          />
        </section>
      )}

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
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/manage/${booking.manageToken}`}
              className="rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper transition-colors hover:bg-black"
            >
              Manage appointment
            </Link>
            <button
              type="button"
              onClick={() => {
                setBooking(null);
                setService(null);
                setSelectedDateKey(null);
                setSelectedSlot(null);
                setSlotQuery(null);
                setSlots(null);
                setStep("service");
              }}
              className="rounded-full border border-line bg-card px-6 py-3.5 text-base font-medium text-ink-soft hover:text-ink"
            >
              Book another appointment
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function formatSelectedDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-MU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}