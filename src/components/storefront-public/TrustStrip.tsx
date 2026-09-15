/**
 * Quiet trust signals: at most three real facts (rating, location,
 * instant online booking). Nothing invented, nothing cluttered.
 */
export default function TrustStrip({
  rating,
  location,
  accent,
}: {
  rating: { average: number; count: number } | null;
  location: string | null;
  accent: string;
}) {
  const signals: Array<{ key: string; node: React.ReactNode }> = [];
  if (rating) {
    signals.push({
      key: "rating",
      node: (
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ color: accent }}>
            <path d="M8 1.5l2.1 4.4 4.9.7-3.5 3.4.8 4.9L8 12.7l-4.3 2.2.8-4.9L1 6.6l4.9-.7L8 1.5z" />
          </svg>
          <span className="font-semibold tabular-nums text-ink">{rating.average.toFixed(1)}</span>
          <span>
            · {rating.count} review{rating.count === 1 ? "" : "s"}
          </span>
        </span>
      ),
    });
  }
  if (location) {
    signals.push({
      key: "location",
      node: (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-ink-soft">
            <path d="M8 14s5-4.6 5-8a5 5 0 1 0-10 0c0 3.4 5 8 5 8z" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="8" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <span className="truncate">{location}</span>
        </span>
      ),
    });
  }
  signals.push({
    key: "booking",
    node: (
      <span className="inline-flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-ink-soft">
          <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Online booking · Instant confirmation
      </span>
    ),
  });

  const shown = signals.slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <div className="border-y border-line/70 bg-card/60">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3.5 text-sm text-ink-soft">
        {shown.map((signal) => (
          <span key={signal.key}>{signal.node}</span>
        ))}
      </div>
    </div>
  );
}
