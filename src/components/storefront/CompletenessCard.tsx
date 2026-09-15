"use client";

import Link from "next/link";

export interface CompletenessFacts {
  logo: boolean;
  cover: boolean;
  headline: boolean;
  about: boolean;
  hours: boolean;
  gallery: boolean;
  team: boolean;
  social: boolean;
}

/**
 * Restrained completeness guidance: deterministic checklist over real
 * optional content. No gamification, no points — nothing here blocks
 * operating the business.
 */
export default function CompletenessCard({ facts }: { facts: CompletenessFacts }) {
  const items = [
    { done: facts.logo, label: "Add your logo", href: "#section-appearance" },
    { done: facts.cover, label: "Add a cover photo", href: "#section-appearance" },
    { done: facts.headline, label: "Write a headline", href: "#section-content" },
    { done: facts.about, label: "Describe your business", href: "#section-content" },
    { done: facts.hours, label: "Set opening hours", href: "/settings" },
    { done: facts.gallery, label: "Add portfolio images", href: "#section-gallery" },
    { done: facts.team, label: "Add your team", href: "#section-team" },
    { done: facts.social, label: "Add social links", href: "#section-social" },
  ];
  const done = items.filter((item) => item.done).length;
  const percent = Math.round((done / items.length) * 100);
  const missing = items.filter((item) => !item.done);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Your storefront is {percent}% complete</h2>
        <p className="text-sm tabular-nums text-ink-soft">
          {done} of {items.length}
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Storefront completeness"
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-blue transition-all" style={{ width: `${percent}%` }} />
      </div>
      {missing.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5">
          {missing.map((item) => (
            <li key={item.label} className="text-sm">
              <Link href={item.href} className="font-medium text-blue-strong hover:underline">
                {item.label} →
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="mt-4 text-sm text-ink-soft">
          Everything&apos;s filled in — Kivo reviews every setup with you before go-live.
        </p>
      )}
    </div>
  );
}
