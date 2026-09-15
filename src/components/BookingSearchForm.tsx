"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getLocalDayInfo, addDaysKey } from "@/lib/availability";

/** Search + date/service filters that navigate with query params (no fetch). */
export default function BookingSearchForm({
  businessId,
  timezone,
  view,
  initialSearch,
  services,
  serviceId,
  resourceId,
  sessionId,
  from,
  to,
}: {
  businessId: string;
  timezone: string;
  view: string;
  initialSearch: string;
  services: Array<{ id: string; name: string }>;
  serviceId: string;
  resourceId: string;
  sessionId: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [service, setService] = useState(serviceId);
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams();
    query.set("business", businessId);
    if (view && view !== "upcoming") query.set("view", view);
    if (search.trim()) query.set("search", search.trim());
    if (service.trim()) query.set("serviceId", service.trim());
    if (resourceId) query.set("resourceId", resourceId);
    if (sessionId) query.set("sessionId", sessionId);
    // Day bounds in the business timezone (never browser UTC).
    if (fromDate) query.set("from", getLocalDayInfo(fromDate, timezone).dayStartUtc);
    if (toDate) {
      query.set("to", getLocalDayInfo(addDaysKey(toDate, 1), timezone).dayStartUtc);
    }
    router.push(`/dashboard/bookings?${query.toString()}`);
  }

  function clear() {
    setSearch("");
    setService("");
    setFromDate("");
    setToDate("");
    router.push(`/dashboard/bookings?business=${businessId}&view=${view}`);
  }

  const inputClass =
    "rounded-xl border border-line bg-card px-3.5 py-2 text-sm outline-none focus:border-blue";

  return (
    <form onSubmit={apply} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          aria-label="Search by customer name or phone"
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          className="rounded-full bg-blue px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-strong"
        >
          Search
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filter by service"
          value={service}
          onChange={(e) => setService(e.target.value)}
          className={`${inputClass} w-44`}
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          aria-label="From date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className={inputClass}
        />
        <input
          aria-label="To date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className={inputClass}
        />
        {(initialSearch || serviceId || resourceId || sessionId || from || to) && (
          <button
            type="button"
            onClick={clear}
            className="text-sm font-medium text-ink-soft hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
