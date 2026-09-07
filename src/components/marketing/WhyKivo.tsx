"use client";

import { useEffect, useRef, useState } from "react";

const BENEFITS = [
  { title: "Bookings 24/7", desc: "Customers can book even when you\u2019re closed." },
  { title: "Less back-and-forth", desc: "Reduce calls and messages just to find an available time." },
  { title: "Your own booking page", desc: "Give customers a professional place to make reservations." },
  { title: "Simple management", desc: "Keep bookings, availability and services organised in one dashboard." },
  { title: "Built to grow with you", desc: "Suitable for individual operators as well as growing businesses." },
];

export default function WhyKivo() {
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
    <section ref={ref} className="bg-surface-muted">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Why Kivo</p>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.08] tracking-tight text-ink">
            The booking flow should feel simple&mdash;for
            <br className="hidden sm:block" />
            {" "}you and your customers.
          </h2>
        </div>

        <div className={`mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-all duration-600 ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
        }`}>
          {BENEFITS.map((b, i) => (
            <div
              key={b.title}
              className={`rounded-2xl border border-line bg-card p-6 ${
                i === BENEFITS.length - 1 && BENEFITS.length % 3 !== 0 ? "sm:col-span-2 lg:col-span-1" : ""
              }`}
              style={{ transitionDelay: `${150 + i * 80}ms`, transitionDuration: "500ms" }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-brand" aria-hidden="true">
                  <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">{b.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
