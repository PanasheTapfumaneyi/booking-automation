/** Badge pill for plan cards — server-compatible, no client state. */

interface PlanBadgeProps {
  label: string;
  variant: "popular" | "ai-early-access";
}

export default function PlanBadge({ label, variant }: PlanBadgeProps) {
  const classes =
    variant === "popular"
      ? "bg-brand text-white"
      : "bg-blue text-white";
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}
