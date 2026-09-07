"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Hero() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative overflow-hidden bg-paper">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-6 pb-16 pt-20 sm:pt-28 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:pb-24 lg:pt-32">
        {/* Left — copy */}
        <div
          className={`transition-all duration-700 ease-out ${
            loaded ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            A simpler way to take bookings
          </p>
          <h1 className="mt-5 text-[clamp(2.5rem,5vw,3.75rem)] font-bold leading-[1.02] tracking-tight text-ink">
            Bookings,
            <br />
            without the back-
            <br />
            and-forth.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            Kivo gives your customers a simple way to book online while giving
            you one place to manage your availability, services and reservations.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-7 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
            >
              Get Started
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center rounded-lg border border-line bg-card px-7 py-3.5 text-base font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
            >
              View Demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            <a href="#how-it-works" className="font-medium underline-offset-4 hover:underline">
              See how it works
            </a>{" "}
            — from availability to confirmed in three steps.
          </p>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <li className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-brand" aria-hidden="true"><path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              No account needed
            </li>
            <li className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-brand" aria-hidden="true"><path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Instant confirmation
            </li>
            <li className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-brand" aria-hidden="true"><path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Free rescheduling
            </li>
          </ul>
        </div>

        {/* Right — dashboard mockup */}
        <div
          className={`relative transition-all duration-700 ease-out delay-200 ${
            loaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          {/* Decorative teal ring */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-[280px] w-[280px] rounded-full border-[3px] border-brand/10" />

          {/* Dashboard card */}
          <div className="relative rounded-2xl border border-line bg-card p-5 shadow-[0_2px_24px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted">Tuesday, 8 September</p>
                <p className="mt-0.5 text-lg font-bold text-ink">Good morning, Alex</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">A</div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: "Today", value: "8", sub: "bookings" },
                { label: "Open", value: "4", sub: "slots" },
                { label: "Next", value: "10:30", sub: "" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-line bg-paper px-3.5 py-3 text-center">
                  <p className="text-xs font-medium text-muted">{stat.label}</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">{stat.value}</p>
                  {stat.sub && <p className="text-[11px] text-ink-soft">{stat.sub}</p>}
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2.5">
              {[
                { time: "09:30", name: "Haircut", customer: "Jamie L.", color: "bg-brand" },
                { time: "10:30", name: "Consultation", customer: "Morgan R.", color: "bg-blue" },
              ].map((b) => (
                <div key={b.time + b.customer} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                  <div className={`h-2 w-2 rounded-full ${b.color}`} />
                  <p className="w-12 text-sm font-semibold tabular-nums text-ink">{b.time}</p>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{b.name}</p>
                    <p className="text-xs text-ink-soft">{b.customer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Booking card — overlapping */}
          <div
            className={`absolute -bottom-6 -left-6 w-[260px] rounded-2xl border border-line bg-card p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-700 ease-out delay-500 sm:w-[280px] ${
              loaded ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Customer booking page</p>
            <p className="mt-2.5 text-sm font-bold text-ink">Choose a service</p>
            <div className="mt-2.5 rounded-xl border border-line bg-paper px-3.5 py-3">
              <p className="text-sm font-semibold text-ink">Standard Service</p>
              <p className="text-xs text-ink-soft">45 min · Available today</p>
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
