import Link from "next/link";

/**
 * Restrained Kivo attribution: secondary, never competing with the
 * business brand. "Bookings powered by Kivo" with a home link.
 */
export default function StorefrontFooter({
  businessName,
  bookHref,
}: {
  businessName: string;
  bookHref: string;
}) {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-ink">{businessName}</span>
          {" · "}
          <Link href={bookHref} className="font-medium hover:text-ink hover:underline">
            Book appointment
          </Link>
        </p>
        <p>
          Bookings powered by{" "}
          <Link href="/" className="font-medium text-ink hover:underline">
            Kivo
          </Link>
        </p>
      </div>
    </footer>
  );
}
