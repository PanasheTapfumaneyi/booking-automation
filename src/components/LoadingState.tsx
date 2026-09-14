"use client";

import { useEffect, useState } from "react";

/** Simple pulse placeholder that reserves layout space. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-ink/10 ${className}`}
    />
  );
}

/**
 * Appears only after ~8s of waiting, so short loads stay quiet but long ones
 * explain themselves (KIVO-010). Rendered in the same reserved layout.
 */
export function SlowNotice() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  if (!slow) return null;
  return (
    <p className="text-sm text-ink-soft">
      This is taking longer than usual. If it doesn&apos;t finish, try again in a
      moment.
    </p>
  );
}

/** Skeletons resembling the service list, so the page never looks blank. */
export function ServiceListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-6 flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}