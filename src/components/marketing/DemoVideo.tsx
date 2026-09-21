"use client";

import { useEffect, useRef, useState } from "react";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

export default function DemoVideo() {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="demo" ref={ref} className="scroll-mt-24 bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 pb-4 pt-4 sm:pt-8">
        <div
          className={`mx-auto max-w-3xl text-center transition-all duration-700 ease-out ${
            visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
          }`}
          style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Watch it work
          </p>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.08] tracking-tight text-ink">
            See a real booking, end to end.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
            A business home page, a customer booking in seconds, the WhatsApp
            confirmation, and the admin view — all in one short demo.
          </p>
        </div>

        <div
          className={`mx-auto mt-10 max-w-4xl transition-all duration-700 ease-out ${
            visible
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-6 scale-[0.97] opacity-0"
          }`}
          style={{
            transitionDelay: "150ms",
            transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          {/* Apple-style floating frame: translucent rim, deep shadow */}
          <div className="relative overflow-hidden rounded-3xl border border-line bg-ink shadow-[0_24px_80px_-16px_rgba(7,30,43,0.45)]">
            {/* Top chrome bar */}
            <div className="flex items-center gap-1.5 border-b border-white/10 bg-ink px-5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="ml-3 hidden truncate text-xs font-medium text-white/50 sm:block">
                kivo — product demo
              </span>
              <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                1:40
              </span>
            </div>
            <video
              ref={videoRef}
              className="aspect-video h-auto w-full bg-black"
              controls
              playsInline
              preload="metadata"
              poster="/og.png"
              aria-label="Kivo product demo video: business page, customer booking flow, WhatsApp notification, and admin dashboard"
              onPlay={() =>
                trackMarketingEvent("demo_video_played", {
                  cta_location: "demo_section",
                })
              }
            >
              <source src="/demo-video.mp4" type="video/mp4" />
              Your browser does not support the video tag.{" "}
              <a href="/demo-video.mp4" className="underline">
                Download the demo video
              </a>
              .
            </video>
          </div>

        </div>
      </div>
    </section>
  );
}
