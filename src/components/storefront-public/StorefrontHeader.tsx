import Link from "next/link";

/**
 * Lightweight storefront header: business identity left, section anchors
 * (only sections that exist) plus one booking CTA right. Sticky and
 * subtle; mobile shows identity + booking action with no hamburger.
 */
export default function StorefrontHeader({
  name,
  logoUrl,
  bookHref,
  accent,
  anchors,
}: {
  name: string;
  logoUrl: string | null;
  bookHref: string;
  accent: string;
  anchors: Array<{ id: string; label: string }>;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="#top" className="flex min-w-0 items-center gap-2.5" aria-label={`${name} — back to top`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-lg object-cover"
            />
          ) : null}
          <span className="truncate text-lg font-bold tracking-tight text-ink">
            {name}
          </span>
        </Link>
        <nav aria-label="Page sections" className="flex items-center gap-1">
          <span className="hidden items-center gap-1 lg:flex">
            {anchors.map((anchor) => (
              <a
                key={anchor.id}
                href={`#${anchor.id}`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
              >
                {anchor.label}
              </a>
            ))}
          </span>
          <Link
            href={bookHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            Book appointment
          </Link>
        </nav>
      </div>
    </header>
  );
}
