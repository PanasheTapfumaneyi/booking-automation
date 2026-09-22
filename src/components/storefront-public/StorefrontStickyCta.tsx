"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Bottom sticky booking bar (mobile only): one clear action, safe-area
 * aware, never covering content (page reserves bottom padding). No
 * attention animations.
 */
export default function StorefrontStickyCta({
  bookHref,
  accent,
}: {
  bookHref: string;
  accent: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-card/95 px-4 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Link
        href={bookHref}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        style={{ backgroundColor: accent }}
      >
        Book appointment
      </Link>
    </div>
  );
}
