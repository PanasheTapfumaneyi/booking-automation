import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingSearchForm from "@/components/BookingSearchForm";
import BusinessBookingForm from "@/components/BusinessBookingForm";
import CopyBookingLink from "@/components/CopyBookingLink";
import { formatTimeInZone, formatLongDateInZone } from "@/lib/availability";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { fetchBusiness } from "@/lib/server/database";
import { getSupabase } from "@/lib/supabase/server";
import {
  listBusinessBookings,
  searchBusinessCustomers,
  getBusinessDayBounds,
  type BookingListFilters,
} from "@/lib/server/business-bookings";
import DashboardShell from "@/components/dashboard/DashboardShell";
import {
  EmptyState,
  StatusBadge,
  primaryActionClass,
} from "@/components/dashboard/ui";
import type { Booking } from "@/types/booking";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookings",
  description: "Search, review and manage bookings.",
  robots: { index: false, follow: false },
};

type View = "today" | "upcoming" | "past" | "cancelled" | "all";

const VIEWS: Array<{ key: View; label: string }> = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

interface BookingsPageProps {
  searchParams: Promise<{
    business?: string;
    view?: string;
    search?: string;
    serviceId?: string;
    resourceId?: string;
    sessionId?: string;
    from?: string;
    to?: string;
    new?: string;
  }>;
}

/** Business booking management: tabs, search, filters, manual creation. */
export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/dashboard/bookings");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const params = await searchParams;
  // A provided but unowned business id is a 404, never a silent fallback to
  // another business (KIVO-027: no cross-tenant leakage through the URL).
  const requestedBusiness =
    params.business && params.business.trim().length > 0 ? params.business : null;
  if (requestedBusiness && !memberships.some((m) => m.business_id === requestedBusiness)) {
    notFound();
  }
  const selectedId = (requestedBusiness ? requestedBusiness : memberships[0].business_id) as string;

  const db = getSupabase();
  const business = await fetchBusiness(selectedId, db).catch(() => null);
  if (!business) redirect("/onboarding");

  const { data: services } = await db
    .from("services")
    .select("id, name")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("name", { ascending: true });

  const view = (VIEWS.some((v) => v.key === params.view) ? params.view : "upcoming") as View;
  const search = (params.search ?? "").trim();
  const now = new Date();
  const bounds = getBusinessDayBounds(business.timezone, now);

  const filters: BookingListFilters = { limit: 50 };
  const LIVE: Booking["status"][] = ["confirmed", "rescheduled"];
  if (view === "today") {
    filters.statuses = [...LIVE];
    filters.fromIso = bounds.dayStartUtc;
    filters.toIso = bounds.dayEndUtc;
  } else if (view === "upcoming") {
    filters.statuses = [...LIVE];
    filters.fromIso = bounds.dayEndUtc;
  } else if (view === "past") {
    filters.toIso = now.toISOString();
    filters.order = "desc";
  } else if (view === "cancelled") {
    filters.statuses = ["cancelled"];
    filters.order = "desc";
  }
  if (params.serviceId) filters.serviceId = params.serviceId;
  if (params.resourceId) filters.resourceId = params.resourceId;
  if (params.sessionId) filters.sessionId = params.sessionId;
  if (params.from) filters.fromIso = params.from;
  if (params.to) filters.toIso = params.to;

  let customerIds: string[] | undefined;
  if (search.length > 0) {
    const customers = await searchBusinessCustomers(business.id, search, db);
    customerIds = customers.map((c) => c.id);
  }
  const bookings =
    customerIds !== undefined && customerIds.length === 0
      ? []
      : await listBusinessBookings(business.id, { ...filters, customerIds }, db);

  const withQuery = (extra: Record<string, string>) => {
    const query = new URLSearchParams();
    query.set("business", business.id);
    if (view !== "upcoming") query.set("view", view);
    if (search) query.set("search", search);
    if (params.serviceId) query.set("serviceId", params.serviceId);
    if (params.resourceId) query.set("resourceId", params.resourceId);
    if (params.sessionId) query.set("sessionId", params.sessionId);
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    for (const [key, value] of Object.entries(extra)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    return `/dashboard/bookings?${query.toString()}`;
  };

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <DashboardShell
          businessId={business.id}
          businessName={business.name}
          businessSlug={business.slug}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
              <p className="mt-1 text-sm text-ink-soft">
                {business.name} · times in {business.timezone}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CopyBookingLink slug={business.slug} />
              <Link
                href={withQuery({ new: params.new ? "" : "1" })}
                className={primaryActionClass}
              >
                {params.new ? "Close" : "New booking"}
              </Link>
            </div>
          </div>

          {params.new && (
            <div className="mt-6 rounded-2xl border border-blue/40 bg-card p-5 sm:p-6">
              <BusinessBookingForm
                businessId={business.id}
                bookingMode={business.booking_mode}
                timezone={business.timezone}
                hours={business.availability ?? null}
              />
            </div>
          )}

          <nav aria-label="Booking views" className="mt-6 flex flex-wrap gap-2">
            {VIEWS.map((tab) => (
              <Link
                key={tab.key}
                href={withQuery({ view: tab.key === "upcoming" ? "" : tab.key })}
                aria-current={view === tab.key ? "page" : undefined}
                className={[
                  "rounded-full border px-4 py-1.5 text-sm transition-colors",
                  view === tab.key
                    ? "border-blue bg-blue-soft font-semibold text-blue-strong"
                    : "border-line bg-card text-ink-soft hover:text-ink",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {(params.resourceId || params.sessionId) && (
            <p className="mt-4 text-sm text-ink-soft">
              Showing bookings for this {params.resourceId ? "item" : "departure"} ·{" "}
              <Link
                href={withQuery({ resourceId: "", sessionId: "" })}
                className="font-medium text-ink hover:underline"
              >
                Show all
              </Link>
            </p>
          )}

          <div className="mt-4">
            <BookingSearchForm
              businessId={business.id}
              timezone={business.timezone}
              view={view}
              initialSearch={search}
              services={services ?? []}
              serviceId={params.serviceId ?? ""}
              resourceId={params.resourceId ?? ""}
              sessionId={params.sessionId ?? ""}
              from={params.from ?? ""}
              to={params.to ?? ""}
            />
          </div>

          {bookings.length === 0 ? (
            <EmptyState
              title={
                search
                  ? "No bookings match that search"
                  : view === "today"
                    ? "No bookings today"
                    : view === "cancelled"
                      ? "No cancelled bookings"
                      : view === "past"
                        ? "No past bookings"
                        : "No upcoming bookings"
              }
              body={
                search
                  ? "Try a different name or phone number."
                  : "New bookings appear here as customers book."
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {bookings.map((booking) => (
                  <li key={booking.id}>
                    <Link
                      href={`/dashboard/bookings/${booking.id}?business=${business.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 transition-colors hover:border-blue/50"
                    >
                      <span className="min-w-0">
                        <span className="font-semibold">
                          {formatLongDateInZone(booking.startTime, business.timezone)} ·{" "}
                          <span className="tabular-nums">
                            {formatTimeInZone(booking.startTime, business.timezone)}
                          </span>
                        </span>
                        <span className="block truncate text-sm text-ink-soft">
                          {booking.serviceName}
                          {booking.resourceName ? ` · ${booking.resourceName}` : ""}
                          {booking.sessionId ? ` · ${booking.quantity} guest${booking.quantity === 1 ? "" : "s"}` : ""}{" "}
                          · {booking.customerName} · {booking.customerPhone}
                        </span>
                      </span>
                      <StatusBadge status={booking.status} />
                    </Link>
                  </li>
              ))}
            </ul>
          )}

          <div className="mt-8">
            <Link href={`/dashboard?business=${business.id}`} className="text-sm font-medium text-ink-soft hover:text-ink">
              ‹ Back to dashboard
            </Link>
          </div>
        </DashboardShell>
      </main>
      <Footer />
    </>
  );
}
