import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { getDemoDashboardData } from "@/lib/server/demo-dashboard";

interface DemoDashboardPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DemoDashboardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getDemoDashboardData(slug, getSupabase()).catch(() => null);
  if (!data) return { title: "Demo not found" };
  return {
    title: `${data.business.name} demo workspace — Kivo`,
    description: `Explore a read-only demo of the Kivo business dashboard for ${data.business.name}.`,
  };
}

function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
}

export default async function DemoDashboardPage({ params }: DemoDashboardPageProps) {
  const { slug } = await params;
  const data = await getDemoDashboardData(slug, getSupabase()).catch(() => null);
  if (!data) notFound();

  const { business, todayKey, today, upcoming, services, resources, sessions } = data;
  const mode = business.booking_mode;
  const next = [...today, ...upcoming].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))[0] ?? null;
  const siteHref = `/business/${business.slug ?? slug}`;
  const bookHref = `/book/${business.slug ?? slug}`;

  return (
    <div className="min-h-full bg-paper text-ink">
      {/* Demo banner */}
      <div className="border-b border-line bg-surface-muted">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft">
            <span className="font-semibold text-ink">Demo workspace</span> — changes are disabled.
          </p>
          <Link href="/signup" className="text-sm font-semibold text-brand hover:underline">
            Start your own Kivo workspace
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-[1200px] px-6 py-10 sm:py-14">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted">{todayKey}</p>
            <h1 className="mt-1 text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-tight">
              {/* Good morning, {business.name} */}
              Good morning
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={siteHref}
              className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
            >
              Business page
            </Link>
            <Link
              href={bookHref}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
            >
              Book as customer
            </Link>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-line bg-card px-4 py-4 text-center sm:px-6">
            <p className="text-xs font-medium text-muted">Today</p>
            <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{today.length}</p>
            <p className="text-[11px] text-ink-soft">bookings</p>
          </div>
          <div className="rounded-2xl border border-line bg-card px-4 py-4 text-center sm:px-6">
            <p className="text-xs font-medium text-muted">Upcoming</p>
            <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{upcoming.length}</p>
            <p className="text-[11px] text-ink-soft">bookings</p>
          </div>
          <div className="rounded-2xl border border-line bg-card px-4 py-4 text-center sm:px-6">
            <p className="text-xs font-medium text-muted">Next up</p>
            <p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">
              {next ? formatTime(next.startTime, business.timezone) : "—"}
            </p>
            <p className="text-[11px] text-ink-soft">{next ? next.serviceName : "nothing scheduled"}</p>
          </div>
        </div>

        {/* Upcoming bookings */}
        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">Upcoming bookings</h2>
          {today.length === 0 && upcoming.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-line bg-card p-8 text-center">
              <p className="font-medium">No upcoming bookings</p>
              <p className="mt-1 text-sm text-ink-soft">
                Try the customer booking flow — new demo bookings appear here.
              </p>
              <Link
                href={bookHref}
                className="mt-4 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
              >
                Make a demo booking
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {[...today, ...upcoming].slice(0, 10).map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <p className="w-12 shrink-0 text-sm font-semibold tabular-nums">
                    {formatTime(b.startTime, business.timezone)}
                  </p>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {b.serviceName}
                      {b.resourceName ? ` · ${b.resourceName}` : ""}
                      {b.quantity > 1 ? ` × ${b.quantity}` : ""}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {b.customerDisplay} · {b.phoneDisplay}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold capitalize text-brand">
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mode panels */}
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-card p-6">
            <h2 className="text-base font-bold">Services</h2>
            <div className="mt-4 space-y-2.5">
              {services.length === 0 && <p className="text-sm text-ink-soft">No services listed.</p>}
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-sm font-bold tabular-nums">Rs {s.price.toLocaleString("en-MU")}</p>
                </div>
              ))}
            </div>
          </section>

          {mode === "resource" && (
            <section className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-base font-bold">Resources</h2>
              <div className="mt-4 space-y-2.5">
                {resources.length === 0 && <p className="text-sm text-ink-soft">No resources listed.</p>}
                {resources.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
                    <p className="text-sm font-semibold">{r.name}</p>
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold capitalize text-brand">
                      {r.resource_type}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {mode === "capacity" && (
            <section className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-base font-bold">Sessions</h2>
              <div className="mt-4 space-y-2.5">
                {sessions.length === 0 && <p className="text-sm text-ink-soft">No sessions scheduled.</p>}
                {sessions.slice(0, 6).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.service_name ?? "Session"}</p>
                      <p className="text-xs text-ink-soft">
                        {new Date(s.start_time).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: business.timezone })}
                        {" · "}
                        {formatTime(s.start_time, business.timezone)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums">
                      {s.booked}/{s.capacity}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {mode === "appointment" && (
            <section className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-base font-bold">About this demo</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                This is a read-only view of a live Kivo workspace. Customer bookings made
                through the demo appear here in real time. Contact details are masked,
                notifications are simulated, and nothing can be changed.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={siteHref}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
                >
                  Business page
                </Link>
                <Link
                  href="/demo"
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
                >
                  All demos
                </Link>
              </div>
            </section>
          )}
        </div>

        <div className="py-8 text-center">
          <p className="text-xs text-muted">Read-only demo · Powered by Kivo</p>
        </div>
      </main>
    </div>
  );
}
