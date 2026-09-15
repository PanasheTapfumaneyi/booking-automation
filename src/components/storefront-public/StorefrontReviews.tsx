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
      className="inline-flex gap-0.5 text-base leading-none"
      style={{ color: "#B98A00" }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} aria-hidden="true" className={star <= full ? "" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * Spacious legitimate reviews: aggregate first, then a few large
 * readable entries. Renders nothing without rows (caller guarantees).
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
      <div className="mx-auto w-full max-w-4xl px-5 py-14 sm:py-20">
        <h2
          id="reviews-title"
          className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink"
        >
          Reviews
        </h2>
        {aggregate && (
          <p className="mt-3 flex items-center gap-2 text-lg text-ink-soft">
            <span className="font-bold tabular-nums text-ink">{aggregate.average.toFixed(1)}</span>
            <Stars rating={aggregate.average} />
            <span>
              · {aggregate.count} review{aggregate.count === 1 ? "" : "s"}
            </span>
          </p>
        )}
        <ul className="mt-8 flex flex-col gap-8">
          {reviews.map((review, index) => (
            <li key={`${review.reviewerName ?? "anon"}-${index}`}>
              <blockquote>
                {typeof review.rating === "number" && (
                  <div className="mb-2">
                    <Stars rating={review.rating} />
                  </div>
                )}
                {review.body && (
                  <p className="max-w-2xl text-lg leading-relaxed text-ink">
                    “{review.body}”
                  </p>
                )}
                <footer className="mt-2 text-sm text-ink-soft">
                  {review.reviewerName ?? "A customer"}
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
