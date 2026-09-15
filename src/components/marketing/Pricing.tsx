"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { whatsappUrl, PRICING } from "@/lib/marketing-config";
import { trackMarketingEvent, useViewedOnce } from "@/lib/marketing-analytics";

const INCLUDED = [
  "Your own professional booking website",
  "Online bookings 24/7",
  "Booking management dashboard",
  "WhatsApp booking confirmations and reminders",
  "Google Calendar integration",
  "Customer rescheduling and cancellation",
  "Service and availability setup",
  "Initial business setup handled for you",
  "Ongoing technical support",
  "Ongoing software updates",
  "Help updating services, availability and booking setup",
  "Ongoing maintenance",
  "Improvements as Kivo develops during beta",
];

export default function Pricing() {
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

  const wa = whatsappUrl();
  const viewedRef = useViewedOnce("pricing_viewed", { cta_location: "pricing" });

  return (
    <section id="pricing" ref={ref} className="bg-paper">
      <div ref={viewedRef} className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Pricing</p>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.08] tracking-tight text-ink">
            Try Kivo free for 1 month.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Then {PRICING.monthlyPrice}. Everything you need to take bookings
            without managing the technical side.
          </p>
        </div>

        <div className={`mt-12 grid gap-5 lg:grid-cols-[1fr_1px_1.2fr] transition-all duration-700 ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}>
          {/* Price card */}
          <div className="rounded-2xl border-2 border-brand bg-card p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Early access / Beta</p>
            <div className="mt-6">
              <p className="text-4xl font-bold text-ink">{PRICING.trialLabel}</p>
              <p className="mt-2 text-lg text-ink-soft">Then {PRICING.monthlyPrice}</p>
            </div>
            <p className="mt-6 leading-relaxed text-ink-soft">
              Set up and managed for you. No technical knowledge needed.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/signup"
                onClick={() =>
                  trackMarketingEvent("start_free_clicked", {
                    cta_location: "pricing",
                    cta_label: "Start your free month",
                  })
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-7 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
              >
                Start your free month
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackMarketingEvent("contact_clicked", {
                      contact_type: "whatsapp",
                      cta_location: "pricing",
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-card px-7 py-3.5 text-base font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor"/>
                  </svg>
                  WhatsApp me
                </a>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden bg-line lg:block" />

          {/* Included list */}
          <div className="rounded-2xl border border-line bg-card p-8">
            <h3 className="text-lg font-bold text-ink">What&apos;s included</h3>
            <ul className="mt-6 space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 text-ink-soft">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-brand" aria-hidden="true">
                    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-xl border border-line bg-surface-muted px-5 py-4">
              <p className="text-sm leading-relaxed text-ink-soft">
                <span className="font-semibold text-ink">During the early-access period</span>, we&apos;re onboarding a small number of businesses. Your first month is free and includes full setup and ongoing support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
