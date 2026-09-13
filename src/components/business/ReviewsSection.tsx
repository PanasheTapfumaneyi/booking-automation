interface Review {
  name: string;
  text: string;
  rating?: number;
}

interface ReviewsSectionProps {
  reviews: Review[];
  businessName: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill={i < rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className={i < rating ? "text-gold" : "text-line"}
          aria-hidden="true"
        >
          <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.14 5.06 16.7 6 11.21l-4-3.9 5.53-.8z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsSection({ reviews, businessName }: ReviewsSectionProps) {
  if (reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-14 sm:py-16">
      <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink">
        What customers say about {businessName}
      </h2>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {reviews.map((review, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-line bg-card p-6"
          >
            <p className="text-sm leading-relaxed text-ink-soft">
              &ldquo;{review.text}&rdquo;
            </p>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{review.name}</p>
              {review.rating !== undefined && (
                <StarRating rating={review.rating} />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
