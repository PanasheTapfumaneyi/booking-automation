"use client";

import { useEffect, useRef, useState } from "react";

const TYPES = [
  {
    num: "01",
    title: "Appointments",
    desc: "For barbers, salons, beauty professionals, consultants and service businesses.",
    footer: "Time-based bookings",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 2V5M15 2V5M2 8.5H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Rentals",
    desc: "For vehicles, surfboards, equipment and other reservable resources.",
    footer: "Resource availability",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M3 14.5L5.5 7C6 5.5 7.5 4.5 9 4.5H13C14.5 4.5 16 5.5 16.5 7L19 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="2" y="14" width="18" height="4.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="6.5" cy="18.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="15.5" cy="18.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Tours & Activities",
    desc: "For tours, classes, experiences and other group bookings with limited spaces.",
    footer: "Capacity scheduling",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="11" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 19C4 15.13 7.13 12 11 12C14.87 12 18 15.13 18 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M15 6L17.5 3.5M17.5 6L15 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BusinessTypes() {
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
    <section id="solutions" ref={ref} className="bg-surface-muted">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Flexible by design</p>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.08] tracking-tight text-ink">
            Built for different businesses.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            One adaptable booking foundation — shaped around how your business
            makes time available.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {TYPES.map((t, i) => (
            <div
              key={t.num}
              className={`group relative flex flex-col rounded-2xl border border-line bg-card p-6 transition-all duration-200 hover:-translate-y-[3px] hover:border-line-strong hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] sm:p-7 ${
                visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
              }`}
              style={{ transitionDelay: `${150 + i * 100}ms`, transitionDuration: "500ms", transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-muted">{t.num}</span>
                <span className="text-brand transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-3">{t.icon}</span>
              </div>
              <h3 className="mt-5 text-xl font-bold text-ink">{t.title}</h3>
              <p className="mt-2 flex-1 leading-relaxed text-ink-soft">{t.desc}</p>
              <div className="mt-6 border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t.footer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
