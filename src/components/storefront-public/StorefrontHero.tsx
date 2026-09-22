import Link from "next/link";
import type { TodayStatus } from "@/lib/storefront-public";

/**
 * Editorial hero. With imagery: asymmetric two-column composition.
 * Without: generous typography on a subtle tinted canvas — never an
 * empty placeholder, never invented claims.
 */
export default function StorefrontHero({
  name,
  eyebrow,
  headline,
  subheadline,
  heroImageUrl,
  heroImageAlt,
  status,
  locationLine,
  bookHref,
  directionsHref,
  contactHref,
  accent,
}: {
  name: string;
  eyebrow: string | null;
  headline: string | null;
  subheadline: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string;
  status: TodayStatus | null;
  locationLine: string | null;
  bookHref: string;
  directionsHref: string | null;
  contactHref: string | null;
  accent: string;
}) {
  const metaLine =
    [status?.label, locationLine].filter(Boolean).join(" · ") || null;

  const metaBadge = (
    <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
      {eyebrow && (
        <span className="inline-flex items-center rounded-full border border-line bg-card px-3 py-1 text-[13px] font-semibold text-ink shadow-sm">
          {eyebrow}
        </span>
      )}
      {status && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-[13px] font-medium text-ink-soft shadow-sm">
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 rounded-full ${status.open ? "bg-green-600" : "bg-slate-400"}`}
          />
          {status.label}
        </span>
      )}
      {locationLine && (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 px-1 py-1 text-sm text-ink-soft">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
            <path d="M8 14s5-4.6 5-8a5 5 0 1 0-10 0c0 3.4 5 8 5 8z" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="8" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <span className="truncate">{locationLine}</span>
        </span>
      )}
    </div>
  );

  const ctaRow = (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
      <Link
        href={bookHref}
        className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow"
        style={{ backgroundColor: accent }}
      >
        Book appointment
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      {directionsHref ? (
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-line bg-card px-8 py-3.5 text-base font-semibold text-ink shadow-sm transition-all hover:border-line-strong hover:shadow"
        >
          Directions
        </a>
      ) : contactHref ? (
        <a
          href={contactHref}
          className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-line bg-card px-8 py-3.5 text-base font-semibold text-ink shadow-sm transition-all hover:border-line-strong hover:shadow"
        >
          Contact
        </a>
      ) : null}
    </div>
  );

  return (
    <section aria-label={`${name} introduction`} className="mx-auto w-full max-w-6xl px-5 pb-12 pt-10 sm:pb-16 sm:pt-14">
      {heroImageUrl ? (
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="min-w-0">
            <h1 className="text-[clamp(2rem,4.5vw,3rem)] font-bold leading-[1.05] tracking-tight text-balance text-ink">
              {name}
            </h1>
            {headline && (
              <p className="mt-4 text-xl font-medium leading-snug text-ink">
                {headline}
              </p>
            )}
            {subheadline && (
              <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-ink-soft">
                {subheadline}
              </p>
            )}
            {metaBadge}
            {ctaRow}
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-line sm:rounded-3xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImageUrl}
                alt={heroImageAlt}
                fetchPriority="high"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-card px-6 py-12 shadow-sm sm:rounded-3xl sm:px-12 sm:py-16">
          <div className="max-w-2xl">
            <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-bold leading-[1.03] tracking-tight text-balance text-ink">
              {name}
            </h1>
            {headline && (
              <p className="mt-4 text-xl font-medium leading-snug text-ink">
                {headline}
              </p>
            )}
            {subheadline && (
              <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-ink-soft">
                {subheadline}
              </p>
            )}
            {metaLine && (
              <p className="mt-5 text-sm text-ink-soft">{metaLine}</p>
            )}
            {ctaRow}
          </div>
        </div>
      )}
    </section>
  );
}
