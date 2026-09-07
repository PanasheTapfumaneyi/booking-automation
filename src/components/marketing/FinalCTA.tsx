"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function FinalCTA() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
        <div className={`overflow-hidden rounded-3xl bg-blue transition-all duration-700 ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}>
          <div className="grid lg:grid-cols-[1fr_1px_1fr]">
            {/* Left */}
            <div className="px-8 py-12 sm:px-12 sm:py-16 lg:px-14">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">Ready when you are</p>
              <h2 className="mt-4 text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.1] tracking-tight text-white">
                Spend less time arranging<br />bookings.
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
                Let Kivo handle the booking process while you focus on running your business.
              </p>
              <Link
                href="/signup"
                className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-[15px] font-semibold text-blue transition-all duration-150 hover:bg-white/90"
              >
                Get Started with Kivo
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <p className="mt-4 text-sm text-white/60">
                Prefer to look around first?{" "}
                <Link href="/demo" className="font-semibold text-white underline-offset-4 hover:underline">
                  Explore the live demo
                </Link>
              </p>
            </div>

            {/* Divider */}
            <div className="hidden bg-white/10 lg:block" />

            {/* Right — confirmation card */}
            <div className="flex items-center justify-center px-8 py-12 sm:px-12 sm:py-16">
              <div className={`w-full max-w-[280px] rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.12)] transition-all duration-700 ease-out delay-300 ${
                visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Booking details</p>
                <p className="mt-3 text-sm font-medium text-ink-soft">You&apos;re all set for</p>
                <p className="mt-1 text-lg font-bold text-ink">Tuesday &middot; 10:30</p>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-soft px-3.5 py-2.5">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-brand" aria-hidden="true">
                    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm font-semibold text-brand">Your booking is confirmed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
