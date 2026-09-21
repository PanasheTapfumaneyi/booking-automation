"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { whatsappUrl, telUrl, PRICING } from "@/lib/marketing-config";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

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

  const wa = whatsappUrl();
  const tel = telUrl();

  return (
    <section ref={ref} id="contact" className="bg-paper scroll-mt-20">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
        <div className={`overflow-hidden rounded-3xl bg-blue transition-all duration-700 ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}>
          <div className="grid lg:grid-cols-[1fr_1px_1fr]">
            {/* Left */}
            <div className="px-8 py-12 sm:px-12 sm:py-16 lg:px-14">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">Ready to take bookings?</p>
              <h2 className="mt-4 text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.1] tracking-tight text-white">
                Tell me how your business<br />handles bookings.
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
                I&apos;ll set Kivo up for you. First month free, then {PRICING.monthlyPrice}.
                Setup, support and ongoing management included.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  onClick={() =>
                    trackMarketingEvent("start_free_clicked", {
                      cta_location: "final_cta",
                      cta_label: "Start your free month",
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-[15px] font-semibold text-blue transition-all duration-150 hover:bg-white/90 active:scale-[0.97]"
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
                        cta_location: "final_cta",
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 px-7 py-3.5 text-[15px] font-medium text-white transition-all duration-150 hover:border-white/60 hover:text-white"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor"/>
                    </svg>
                    WhatsApp me
                  </a>
                )}
              </div>
              <p className="mt-4 text-sm text-white/60">
                First month free. No setup fee. No contracts.
                {tel && (
                  <>
                    {" "}Prefer to talk?{" "}
                    <a href={tel} className="font-medium text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
                      Call us
                    </a>
                    .
                  </>
                )}
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
