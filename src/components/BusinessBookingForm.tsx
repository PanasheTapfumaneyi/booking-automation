"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookingCalendar from "@/components/BookingCalendar";
import { zonedInstant, type BusinessHours } from "@/lib/availability";
import { apiGetAvailability, BookingApiError } from "@/lib/booking-api";
import type { TimeSlot as SlotOption } from "@/types/booking";
import type { BookingMode } from "@/types/booking";

interface CatalogService {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  active: boolean;
}

interface CatalogResource {
  id: string;
  name: string;
  active: boolean;
}

interface CatalogSession {
  id: string;
  service_id: string;
  service_name: string | null;
  start_time: string;
  end_time: string | null;
  capacity: number;
  active: boolean;
}

interface FoundCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

/** Owner-side manual booking: same engine, availability, and guarantees. */
export default function BusinessBookingForm({
  businessId,
  bookingMode,
  timezone,
  hours,
}: {
  businessId: string;
  bookingMode: BookingMode;
  timezone: string;
  hours: BusinessHours | null;
}) {
  const router = useRouter();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [resources, setResources] = useState<CatalogResource[]>([]);
  const [sessions, setSessions] = useState<CatalogSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [serviceId, setServiceId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [customerQuery, setCustomerQuery] = useState("");
  const [foundCustomers, setFoundCustomers] = useState<FoundCustomer[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [servicesRes, resourcesRes, sessionsRes] = await Promise.all([
          fetch(`/api/businesses/${businessId}/services`),
          fetch(`/api/businesses/${businessId}/resources`),
          fetch(`/api/businesses/${businessId}/sessions`),
        ]);
        if (!servicesRes.ok) throw new Error("services");
        const servicesData = (await servicesRes.json()) as { services: CatalogService[] };
        if (cancelled) return;
        setServices(servicesData.services.filter((s) => s.active));
        if (bookingMode === "resource" && resourcesRes.ok) {
          const resourcesData = (await resourcesRes.json()) as { resources: CatalogResource[] };
          if (!cancelled) setResources(resourcesData.resources.filter((r) => r.active));
        }
        if (bookingMode === "capacity" && sessionsRes.ok) {
          const sessionsData = (await sessionsRes.json()) as { sessions: CatalogSession[] };
          if (!cancelled) setSessions(sessionsData.sessions.filter((s) => s.active));
        }
      } catch {
        if (!cancelled) setError("We couldn't load your offering. Please reload and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, bookingMode]);

  async function loadSlots(nextDateKey: string) {
    if (!serviceId) return;
    setDateKey(nextDateKey);
    setSlot(null);
    setSlots(null);
    setError(null);
    try {
      const availability = await apiGetAvailability({
        serviceId,
        date: nextDateKey,
        businessId,
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

  async function searchCustomers() {
    if (customerQuery.trim().length < 2) {
      setFoundCustomers([]);
      return;
    }
    try {
      const response = await fetch(
        `/api/businesses/${businessId}/customers/search?q=${encodeURIComponent(customerQuery.trim())}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as { customers: FoundCustomer[] };
      setFoundCustomers(data.customers);
    } catch {
      // Search is a convenience — typing a new customer always works.
    }
  }

  function pickCustomer(customer: FoundCustomer) {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerEmail(customer.email ?? "");
    setFoundCustomers([]);
    setCustomerQuery("");
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { serviceId };
      if (bookingMode === "appointment") {
        if (!slot) throw new Error("Please choose a time slot.");
        body.startTime = slot.startTime;
        body.endTime = slot.endTime;
      } else if (bookingMode === "resource") {
        if (!resourceId || !startTime || !endTime) {
          throw new Error("Please choose an item, date, start and end time.");
        }
        if (!dateKey) throw new Error("Please choose a date.");
        body.resourceId = resourceId;
        body.startTime = zonedInstant(dateKey, startTime, timezone);
        body.endTime = zonedInstant(dateKey, endTime, timezone);
      } else {
        if (!sessionId) throw new Error("Please choose a departure.");
        body.sessionId = sessionId;
        body.quantity = Number(quantity) || 1;
        body.startTime = new Date().toISOString();
        body.endTime = new Date().toISOString();
      }
      if (customerId) {
        body.customerId = customerId;
      } else {
        body.name = customerName;
        body.phone = customerPhone;
        body.email = customerEmail;
      }
      const response = await fetch(`/api/businesses/${businessId}/bookings/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: { userMessage?: string };
        booking?: { id: string };
      } | null;
      if (!response.ok || !data?.booking) {
        throw new Error(data?.error?.userMessage ?? "We couldn't save this booking.");
      }
      router.push(`/dashboard/bookings/${data.booking.id}?business=${businessId}`);
      router.refresh();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't save this booking.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-gold disabled:opacity-40";

  if (loading) {
    return <p className="py-4 text-sm text-ink-soft">Loading your offering…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">New booking</h2>
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Service
        <select
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setDateKey(null);
            setSlots(null);
            setSlot(null);
          }}
          className={inputClass}
        >
          <option value="">Choose a service…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.duration_minutes} min · Rs{s.price}
            </option>
          ))}
        </select>
      </label>

      {bookingMode === "resource" && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Item
          <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} className={inputClass}>
            <option value="">Choose an item…</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
      )}

      {bookingMode === "capacity" ? (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Departure
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={inputClass}>
              <option value="">Choose a departure…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.service_name ?? "Session"} · {new Date(s.start_time).toLocaleString()} · {s.capacity} seats
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Guests
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" className={inputClass} />
          </label>
        </>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium">Date</p>
            <div className="mt-2">
              <BookingCalendar selectedDateKey={dateKey} onSelectDateKey={loadSlots} hours={hours} />
            </div>
          </div>
          {bookingMode === "appointment" && (
            <>
              {dateKey && slots === null && (
                <p className="text-sm text-ink-soft">Checking available times…</p>
              )}
              {slots !== null && slots.length === 0 && (
                <p className="text-sm text-ink-soft">No open times on this day.</p>
              )}
              {slots !== null && slots.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
              )}
            </>
          )}
          {bookingMode === "resource" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Start time
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                End time
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
              </label>
            </div>
          )}
        </>
      )}

      <div>
        <p className="text-sm font-medium">Customer</p>
        {customerId ? (
          <p className="mt-2 text-sm">
            {customerName} · <span className="tabular-nums">{customerPhone}</span>{" "}
            <button type="button" onClick={() => { setCustomerId(null); setCustomerName(""); setCustomerPhone(""); setCustomerEmail(""); }} className="ml-2 font-medium text-ink-soft hover:text-ink">
              Change
            </button>
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                aria-label="Search existing customers"
                placeholder="Search name or phone…"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void searchCustomers();
                  }
                }}
                className={`${inputClass} flex-1`}
              />
              <button type="button" onClick={searchCustomers} className="rounded-full border border-line px-4 py-2 text-sm font-medium">
                Search
              </button>
            </div>
            {foundCustomers.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {foundCustomers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickCustomer(c)}
                      className="w-full rounded-xl border border-line px-3.5 py-2 text-left text-sm hover:border-gold/60"
                    >
                      {c.name} · <span className="tabular-nums">{c.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input aria-label="Customer name" placeholder="Full name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
              <input aria-label="Customer phone" placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} />
            </div>
            <input aria-label="Customer email (optional)" placeholder="Email (optional)" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={inputClass} />
            <p className="text-xs text-ink-soft">Matching phone numbers reuse the existing customer.</p>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          disabled={busy || !serviceId}
          onClick={submit}
          className="w-full rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-paper hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Saving…" : "Confirm booking"}
        </button>
        <p className="mt-2 text-xs text-ink-soft">
          Saves through the same checks as online booking — conflicts and calendar rules apply. The customer gets the usual WhatsApp confirmation.
        </p>
      </div>
      <p className="text-xs text-ink-soft">Times shown in {timezone}.</p>
    </div>
  );
}
