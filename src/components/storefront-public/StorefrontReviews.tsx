export interface PublicReview {
  reviewerName: string | null;
  rating: number | null;
  body: string | null;
  dateLabel: string | null;
  source: string | null;
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span
      role="img"
      aria-label={`Rated ${rating} out of 5`}
      className="inline-flex items-center gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className={star <= full ? "text-[#9A7400]" : "text-line-strong"}
        >
          <path d="M8 1.5l2.1 4.4 4.9.7-3.5 3.4.8 4.9L8 12.7l-4.3 2.2.8-4.9L1 6.6l4.9-.7L8 1.5z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Professional reviews: aggregate summary first, then review cards in a
 * responsive grid. Renders nothing without rows (caller guarantees).
 */
export default function StorefrontReviews({
  reviews,
  aggregate,
}: {
  reviews: PublicReview[];
  aggregate: { average: number; count: number } | null;
}) {
  if (reviews.length === 0) return null;
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
        <div className="max-w-2xl">
          <h2
            id="reviews-title"
            className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]"
          >
            Reviews
          </h2>
          {aggregate && (
            <p className="mt-3 flex items-center gap-2.5 text-[15px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 shadow-sm">
                <span className="font-bold tabular-nums text-ink">{aggregate.average.toFixed(1)}</span>
                <Stars rating={aggregate.average} />
              </span>
              <span>
                {aggregate.count} review{aggregate.count === 1 ? "" : "s"}
              </span>
            </p>
          )}
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <li
              key={`${review.reviewerName ?? "anon"}-${index}`}
              className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm"
            >
              <blockquote className="flex flex-1 flex-col">
                {typeof review.rating === "number" && (
                  <div className="mb-3">
                    <Stars rating={review.rating} />
                  </div>
                )}
                {review.body && (
                  <p className="flex-1 text-[15px] leading-relaxed text-ink">
                    &ldquo;{review.body}&rdquo;
                  </p>
                )}
                <footer className="mt-4 border-t border-line pt-3 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{review.reviewerName ?? "A customer"}</span>
                  {review.dateLabel ? ` · ${review.dateLabel}` : ""}
                  {review.source && review.source !== "manual" ? ` · via ${review.source}` : ""}
                </footer>
              </blockquote>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
