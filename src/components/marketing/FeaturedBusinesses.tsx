"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FEATURED_BUSINESSES, type FeaturedBusiness } from "@/lib/marketing-config";

const MODE_ICONS: Record<string, React.JSX.Element> = {
  appointment: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 2V5M15 2V5M2 8.5H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  resource: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M3 14.5L5.5 7C6 5.5 7.5 4.5 9 4.5H13C14.5 4.5 16 5.5 16.5 7L19 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="2" y="14" width="18" height="4.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.5" cy="18.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="15.5" cy="18.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  capacity: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 19C4 15.13 7.13 12 11 12C14.87 12 18 15.13 18 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

function BusinessCard({ business, index }: { business: FeaturedBusiness; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition-all duration-200 hover:-translate-y-[3px] hover:border-line-strong hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] ${
        visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      }`}
      style={{ transitionDelay: `${150 + index * 100}ms`, transitionDuration: "500ms", transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
    >
      <div className="flex items-center justify-between bg-gradient-to-br from-blue-soft via-blue-mist to-aqua-soft px-6 py-5">
        <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-blue-strong">
          {business.category}
        </span>
        <span className="text-blue transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-3">
          {MODE_ICONS[business.mode]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-bold text-ink">{business.name}</h3>
        <p className="mt-2 flex-1 leading-relaxed text-ink-soft">{business.description}</p>
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{business.modeLabel}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-6 pb-6">
        <Link
          href={`/book/${business.slug}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
        >
          Book now
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Link
          href={`/business/${business.slug}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:border-brand hover:text-brand"
        >
          View business
        </Link>
      </div>
    </div>
  );
}

export default function FeaturedBusinesses() {
  return (
    <section id="showcase" className="bg-surface-muted">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">See Kivo in action</p>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.08] tracking-tight text-ink">
            Built for businesses like yours.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Explore real booking flows for different business types. Each one
            uses the full Kivo engine &mdash; not a mockup.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_BUSINESSES.map((business, i) => (
            <BusinessCard key={business.slug} business={business} index={i} />
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-6 py-3 text-sm font-semibold text-ink transition-all duration-150 hover:border-line-strong hover:text-ink"
          >
            View all live sites
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
