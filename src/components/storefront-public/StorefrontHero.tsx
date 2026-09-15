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

  return (
    <section aria-label={`${name} introduction`} className="mx-auto w-full max-w-6xl px-5 pb-14 pt-10 sm:pb-20 sm:pt-14">
      {heroImageUrl ? (
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-soft">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-4 text-[clamp(2rem,4.5vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
              {name}
            </h1>
            {headline && (
              <p className="mt-4 text-xl font-medium leading-snug text-ink">
                {headline}
              </p>
            )}
            {subheadline && (
              <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-soft">
                {subheadline}
              </p>
            )}
            {metaLine && (
              <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
                {status && (
                  <span
                    aria-hidden="true"
                    className={`inline-block h-2 w-2 rounded-full ${status.open ? "bg-green-600" : "bg-ink-soft/50"}`}
                  />
                )}
                {metaLine}
              </p>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={bookHref}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Book appointment
              </Link>
              {directionsHref ? (
                <a
                  href={directionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-line bg-card px-8 py-3.5 text-base font-medium text-ink transition-colors hover:border-line-strong"
                >
                  Directions
                </a>
              ) : contactHref ? (
                <a
                  href={contactHref}
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-line bg-card px-8 py-3.5 text-base font-medium text-ink transition-colors hover:border-line-strong"
                >
                  Contact
                </a>
              ) : null}
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-2xl sm:rounded-3xl">
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
        <div
          className="overflow-hidden rounded-2xl px-6 py-12 sm:rounded-3xl sm:px-12 sm:py-16"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0)), linear-gradient(135deg, ${accent}14, transparent 60%)`,
          }}
        >
          <div className="max-w-2xl">
            {eyebrow && (
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-soft">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-4 text-[clamp(2.25rem,5vw,3.5rem)] font-bold leading-[1.03] tracking-tight text-ink">
              {name}
            </h1>
            {headline && (
              <p className="mt-4 text-xl font-medium leading-snug text-ink">
                {headline}
              </p>
            )}
            {subheadline && (
              <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-soft">
                {subheadline}
              </p>
            )}
            {metaLine && (
              <p className="mt-5 text-sm text-ink-soft">{metaLine}</p>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={bookHref}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Book appointment
              </Link>
              {directionsHref ? (
                <a
                  href={directionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-line bg-card px-8 py-3.5 text-base font-medium text-ink transition-colors hover:border-line-strong"
                >
                  Directions
                </a>
              ) : contactHref ? (
                <a
                  href={contactHref}
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-line bg-card px-8 py-3.5 text-base font-medium text-ink transition-colors hover:border-line-strong"
                >
                  Contact
                </a>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
