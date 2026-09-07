"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    num: "01",
    title: "Set up your business",
    desc: "Add your services, availability, resources or booking options.",
  },
  {
    num: "02",
    title: "Share your booking page",
    desc: "Give customers a simple link they can access from your website, Instagram, WhatsApp or anywhere else.",
  },
  {
    num: "03",
    title: "Manage everything in one place",
    desc: "View upcoming bookings, customer information and availability from your Kivo dashboard.",
  },
];

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="how-it-works" ref={ref} className="bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32 lg:grid lg:grid-cols-2 lg:gap-16">
        {/* Left */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">How it works</p>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.08] tracking-tight text-ink">
            A clear path from availability
            <br className="hidden sm:block" />
            {" "}to confirmed.
          </h2>
        </div>

        {/* Right — timeline */}
        <div className="mt-12 lg:mt-0">
          <div className="relative ml-4 border-l-2 border-line pl-10">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className={`relative pb-12 last:pb-0 transition-all duration-500 ease-out ${
                  visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: `${200 + i * 150}ms` }}
              >
                {/* Dot */}
                <div className="absolute -left-[calc(10px+1px)] top-0 flex h-5 w-5 items-center justify-center">
                  <div className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${
                    visible ? "bg-brand scale-100" : "bg-line scale-75"
                  }`} style={{ transitionDelay: `${300 + i * 150}ms` }} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{step.num}</p>
                <h3 className="mt-2 text-xl font-bold text-ink">{step.title}</h3>
                <p className="mt-2 max-w-sm leading-relaxed text-ink-soft">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
