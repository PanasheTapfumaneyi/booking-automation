import Link from "next/link";

interface OfferingCardProps {
  name: string;
  description: string | null;
  imageUrl: string | null;
  duration?: string;
  price?: string;
  capacity?: { remaining: number; total: number };
  sessionTime?: string;
  bookHref: string;
  ctaLabel: string;
  theme: { primary: string };
}

export default function OfferingCard({
  name,
  description,
  imageUrl,
  duration,
  price,
  capacity,
  sessionTime,
  bookHref,
  ctaLabel,
  theme,
}: OfferingCardProps) {
  const hasImage = Boolean(imageUrl);

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-card transition-all duration-150 hover:border-line-strong">
      {hasImage ? (
        <div className="relative aspect-video overflow-hidden rounded-t-2xl">
          <img
            src={imageUrl!}
            alt={name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-t-2xl bg-surface-muted">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="text-muted"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-ink">{name}</h3>

        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted">
          {duration && <span>{duration}</span>}
          {price && <span className="text-base font-bold tabular-nums text-ink">{price}</span>}
          {capacity && (
            <span>
              {capacity.remaining <= 0
                ? "Full"
                : `${capacity.remaining} of ${capacity.total} spots left`}
            </span>
          )}
          {sessionTime && <span>{sessionTime}</span>}
        </div>

        <div className="mt-auto pt-4">
          {capacity && capacity.remaining <= 0 ? (
            <span className="inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-surface-muted px-5 py-2.5 text-sm font-semibold text-muted">
              Full
            </span>
          ) : (
            <Link
              href={bookHref}
              className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:opacity-90"
              style={{ backgroundColor: theme.primary }}
            >
              {ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
