"use client";

import { useEffect, useRef, useState } from "react";

export default function ProductPreview() {
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
    <section id="product" ref={ref} className="bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Product preview</p>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.08] tracking-tight text-ink">
            The details of your day, visible at a glance.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            A connected workspace for each part of the booking process.
          </p>
        </div>

        <div className={`mt-12 grid gap-5 lg:grid-cols-2 transition-all duration-700 ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}>
          {/* Upcoming bookings card */}
          <div className="rounded-2xl border border-line bg-card p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Upcoming bookings</h3>
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">8 today</span>
            </div>
            <p className="mt-1 text-xs text-muted">Today &middot; 8 bookings</p>
            <div className="mt-5 space-y-3">
              {[
                { name: "Morgan R.", time: "10:30", status: "Confirmed" },
                { name: "Taylor J.", time: "11:00", status: "Confirmed" },
                { name: "Samira K.", time: "11:30", status: "Confirmed" },
              ].map((b) => (
                <div key={b.name} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                  <div className="h-2 w-2 rounded-full bg-brand" />
                  <p className="w-12 text-sm font-semibold tabular-nums text-ink">{b.time}</p>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{b.name}</p>
                  </div>
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">{b.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar + Services */}
          <div className="flex flex-col gap-5">
            {/* Calendar heatmap */}
            <div className="rounded-2xl border border-line bg-card p-6">
              <h3 className="text-base font-bold text-ink">Calendar & availability</h3>
              <p className="mt-1 text-xs text-muted">Week view &middot; 8&ndash;14 Sep</p>
              <div className="mt-5 grid grid-cols-7 gap-1.5">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <p key={`${d}-${i}`} className="text-center text-[11px] font-medium text-muted">{d}</p>
                ))}
                {[30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].slice(0, 14).map((day, i) => {
                  const intensities = [0, 0, 1, 2, 3, 2, 0, 3, 4, 3, 1, 2, 4, 0];
                  const level = intensities[i] ?? 0;
                  const colors = ["bg-surface-muted", "bg-brand/10", "bg-brand/20", "bg-brand/40", "bg-brand/60"];
                  return (
                    <div key={`day-${day}-${i}`} className={`aspect-square rounded-md ${colors[level]} flex items-center justify-center`}>
                      <span className="text-[11px] font-medium text-ink-soft">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Services */}
            <div className="rounded-2xl border border-line bg-card p-6">
              <h3 className="text-base font-bold text-ink">Services</h3>
              <div className="mt-4 space-y-2.5">
                {[
                  { name: "Haircut", duration: "45 min", price: "Rs 500" },
                  { name: "Haircut + Beard", duration: "60 min", price: "Rs 700" },
                  { name: "Beard Trim", duration: "30 min", price: "Rs 300" },
                ].map((s) => (
                  <div key={s.name} className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-ink-soft">{s.duration}</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-ink">{s.price}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
