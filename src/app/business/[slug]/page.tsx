import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getSupabase } from "@/lib/supabase/server";
import { getBusinessSiteData } from "@/lib/server/public-site";
import { minutesToLabel } from "@/lib/availability";
import { formatPrice } from "@/lib/demo";
import { WEEKDAY_KEYS, type BusinessHours } from "@/lib/availability/hours";

interface BusinessPageProps {
  params: Promise<{ slug: string }>;
}

const MODE_LABEL: Record<string, string> = {
  appointment: "Appointments",
  resource: "Rentals",
  capacity: "Classes & Tours",
};

const MODE_TAGLINE: Record<string, string> = {
  appointment: "Simple booking, without the back-and-forth.",
  resource: "Reserve what you need, when you need it.",
  capacity: "Join a session — spots are limited.",
};

const WEEKDAY_LABEL: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export async function generateMetadata({ params }: BusinessPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessSiteData(slug, getSupabase()).catch(() => null);
  if (!data) return { title: "Business not found — Kivo" };
  return {
    title: `${data.business.name} — Book online`,
    description: `View services and book online at ${data.business.name}. ${MODE_TAGLINE[data.business.booking_mode] ?? ""}`,
  };
}

export default async function BusinessPage({ params }: BusinessPageProps) {
  const { slug } = await params;
  const data = await getBusinessSiteData(slug, getSupabase()).catch(() => null);
  if (!data) notFound();

  const { business, services, resources, sessions } = data;
  const mode = business.booking_mode;
  const bookHref = `/book/${business.slug ?? slug}`;
  const hours = (business.availability ?? null) as BusinessHours | null;
  const tagline = business.tagline || MODE_TAGLINE[mode] || "Book online in under a minute.";

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero — the business's identity first */}
        <section
          className="border-b border-line bg-paper"
          style={business.cover_image_url ? {
            backgroundImage: `url(${business.cover_image_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          } : undefined}
        >
          <div className={`mx-auto max-w-[1200px] px-6 py-16 sm:py-20 ${business.cover_image_url ? "bg-ink/60 text-white" : ""}`}>
            {business.logo_url && (
              <img
                src={business.logo_url}
                alt={`${business.name} logo`}
                className="mb-4 h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16"
              />
            )}
            <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${business.cover_image_url ? "text-white/80" : "text-brand"}`}>
              {MODE_LABEL[mode] ?? "Bookings"}
            </p>
            <h1 className="mt-4 max-w-2xl text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.05] tracking-tight">
              {business.name}
            </h1>
            <p className={`mt-4 max-w-xl text-lg leading-relaxed ${business.cover_image_url ? "text-white/80" : "text-ink-soft"}`}>
              {tagline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={bookHref}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-7 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
              >
                Book now
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              {business.phone && (
                <a
                  href={`tel:${business.phone.replace(/\s+/g, "")}`}
                  className={`inline-flex items-center justify-center rounded-lg border px-7 py-3.5 text-base font-medium transition-all duration-150 ${
                    business.cover_image_url
                      ? "border-white/30 text-white hover:border-white/60 hover:text-white"
                      : "border-line bg-card text-ink-soft hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {business.phone}
                </a>
              )}
            </div>
          </div>
        </section>

        {/* About — custom description */}
        {business.description && (
          <section className="mx-auto max-w-[1200px] px-6 py-14 sm:py-16">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink">About</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft whitespace-pre-line">
              {business.description}
            </p>
          </section>
        )}

        {/* Offerings */}
        <section className="mx-auto max-w-[1200px] px-6 py-14 sm:py-20">
          {mode === "appointment" && (
            <>
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink">Services</h2>
              {services.length === 0 ? (
                <p className="mt-4 text-ink-soft">No services are currently listed. Please check back soon.</p>
              ) : (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((s) => (
                    <div key={s.id} className="flex flex-col rounded-2xl border border-line bg-card p-6">
                      <h3 className="text-lg font-bold text-ink">{s.name}</h3>
                      <div className="mt-2 flex items-baseline justify-between">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted">
                          {minutesToLabel(s.duration_minutes)}
                        </p>
                        <p className="text-xl font-bold tabular-nums text-ink">{formatPrice(s.price)}</p>
                      </div>
                      <Link
                        href={bookHref}
                        className="mt-5 inline-flex items-center justify-center rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:border-brand hover:text-brand"
                      >
                        Book
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === "resource" && (
            <>
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink">Available to reserve</h2>
              {resources.length === 0 ? (
                <p className="mt-4 text-ink-soft">No items are currently listed. Please check back soon.</p>
              ) : (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {resources.map((r) => (
                    <div key={r.id} className="flex flex-col rounded-2xl border border-line bg-card p-6">
                      <h3 className="text-lg font-bold text-ink">{r.name}</h3>
                      <p className="mt-1 text-sm capitalize text-muted">{r.resource_type}</p>
                      <Link
                        href={bookHref}
                        className="mt-5 inline-flex items-center justify-center rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:border-brand hover:text-brand"
                      >
                        Check availability
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === "capacity" && (
            <>
              <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink">Upcoming sessions</h2>
              {sessions.length === 0 ? (
                <p className="mt-4 text-ink-soft">No sessions are currently scheduled. Please check back soon.</p>
              ) : (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sessions.map((s) => {
                    const start = new Date(s.start_time);
                    const date = start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: business.timezone });
                    const time = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: business.timezone });
                    const full = s.remaining <= 0;
                    return (
                      <div key={s.id} className="flex flex-col rounded-2xl border border-line bg-card p-6">
                        <p className="text-sm font-semibold text-ink">{s.service_name ?? "Session"}</p>
                        <p className="mt-1 text-sm text-ink-soft">{date} · {time}</p>
                        <p className="mt-2 text-xs font-medium text-muted">
                          {full ? "Full" : `${s.remaining} of ${s.capacity} spots left`}
                        </p>
                        {full ? (
                          <span className="mt-5 inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-surface-muted px-5 py-2.5 text-sm font-semibold text-muted">
                            Full
                          </span>
                        ) : (
                          <Link
                            href={bookHref}
                            className="mt-5 inline-flex items-center justify-center rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:border-brand hover:text-brand"
                          >
                            Book a spot
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* Details */}
        <section className="border-t border-line bg-card">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-14 sm:py-16 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">Opening hours</h2>
              {hours ? (
                <dl className="mt-5 space-y-2.5">
                  {WEEKDAY_KEYS.map((day) => {
                    const h = hours[day];
                    return (
                      <div key={day} className="flex items-center justify-between gap-4 border-b border-line pb-2.5 last:border-0">
                        <dt className="text-ink-soft">{WEEKDAY_LABEL[day]}</dt>
                        <dd className="font-medium tabular-nums text-ink">
                          {h ? `${h.open} – ${h.close}` : "Closed"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <p className="mt-4 text-ink-soft">Contact {business.name} for opening hours.</p>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">Contact</h2>
              <div className="mt-5 space-y-2 text-ink-soft">
                {business.phone && <p className="font-medium text-ink">{business.phone}</p>}
                {business.email && <p>{business.email}</p>}
                {!business.phone && !business.email && (
                  <p>Book online — no phone call needed.</p>
                )}
              </div>
              <Link
                href={bookHref}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
              >
                Book now
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1200px] px-6 py-8 text-center">
          <p className="text-xs text-muted">Powered by Kivo</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
