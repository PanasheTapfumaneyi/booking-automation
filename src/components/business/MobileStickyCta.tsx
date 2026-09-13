"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MobileStickyCtaProps {
  bookHref: string;
  primary: string;
}

export default function MobileStickyCta({ bookHref, primary }: MobileStickyCtaProps) {
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
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-card/95 px-4 py-3 backdrop-blur-sm sm:hidden">
      <Link
        href={bookHref}
        className="flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-base font-semibold text-white transition-all duration-150 hover:opacity-90"
        style={{ backgroundColor: primary }}
      >
        Book now
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}
