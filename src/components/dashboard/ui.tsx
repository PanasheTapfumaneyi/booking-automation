import Link from "next/link";

/**
 * Shared dashboard primitives — one visual language for /dashboard,
 * /dashboard/bookings, booking details, and settings.
 *
 * Server-compatible (no client hooks) so Server Components can import
 * directly. Status color always pairs with a text label — color is never
 * the only signal.
 */

/** Primary action (deep Kivo blue) and secondary action class strings. */
export const primaryActionClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-full bg-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40";

export const secondaryActionClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-blue/50 hover:text-blue-strong";

function humanizeStatus(status: string): string {
  const map: Record<string, string> = {
    confirmed: "Confirmed",
    rescheduled: "Rescheduled",
    cancelled: "Cancelled",
    pending: "Pending",
    sent: "Sent",
    failed: "Failed",
  };
  return map[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

/** Booking status badge. Confirmed = strong blue, rescheduled = teal. */
export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "cancelled"
      ? "bg-red-50 text-red-700"
      : status === "rescheduled"
        ? "bg-aqua-soft text-brand-hover"
        : status === "pending"
          ? "bg-gold-soft text-gold-strong"
          : "bg-blue-soft text-blue-strong";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {humanizeStatus(status)}
    </span>
  );
}

/** Notification delivery badge for the booking detail timeline. */
export function NotificationBadge({ status }: { status: string }) {
  const tone =
    status === "sent"
      ? "bg-blue-soft text-blue-strong"
      : status === "failed"
        ? "bg-red-50 text-red-700"
        : "border border-line bg-card text-ink-soft";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {humanizeStatus(status)}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-card p-6 text-center sm:p-8">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{body}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className={`${primaryActionClass} mt-4`}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  tone?: "warn";
}) {
  const body = (
    <>
      <span
        className={`text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-red-700" : "text-blue-ink"}`}
      >
        {value}
      </span>
      <span className="mt-1 text-xs text-ink-soft">{label}</span>
    </>
  );
  const className =
    "flex min-h-[88px] flex-col justify-center rounded-2xl border border-line bg-card px-4 py-3 transition-colors";
  return href ? (
    <Link href={href} className={`${className} hover:border-blue/50`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Section heading row with an optional trailing link. */
export function SectionHeading({
  title,
  actionHref,
  actionLabel,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="shrink-0 text-sm font-medium text-blue-strong hover:text-blue-ink hover:underline"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
