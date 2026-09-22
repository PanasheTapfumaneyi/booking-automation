"use client";

/**
 * Pricing cards section — renders three plan cards with analytics tracking.
 *
 * - `showIntro`: render section heading + introductory copy (default true).
 * - `showComparisonLink`: render "See all plans → /pricing" link (default true).
 *
 * Used on the homepage (showIntro + showComparisonLink) and on /pricing
 * (showIntro false — the page provides its own hero).
 */
import Link from "next/link";
import { useRef } from "react";
import {
  PLANS,
  formatPrice,
  planCtaHref,
  getTierSpecificFeatures,
  getInheritanceLabel,
  type MarketingPlan,
} from "@/lib/marketing-config";
import { trackMarketingEvent, useViewedOnce } from "@/lib/marketing-analytics";
import PlanBadge from "./PlanBadge";

interface PricingCardsProps {
  showIntro?: boolean;
  showComparisonLink?: boolean;
  plans?: readonly MarketingPlan[];
}

export default function PricingCards({
  showIntro = true,
  showComparisonLink = true,
  plans = PLANS,
}: PricingCardsProps) {
  const viewedRef = useViewedOnce("pricing_viewed", { cta_location: "pricing" });

  return (
    <section id="pricing" className="scroll-mt-24 bg-paper">
      <div ref={viewedRef} className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
        {showIntro && (
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
              Pricing
            </p>
            <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.08] tracking-tight text-ink">
              Try Kivo free for 1 month.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              Plans from Rs 900/month. Everything you need to take bookings
              without managing the technical side.
            </p>
          </div>
        )}

        <div
          className={`mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3`}
        >
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </div>

        {showComparisonLink && (
          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="text-sm font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
            >
              See all plans and compare features →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Individual card
// ---------------------------------------------------------------------------

function PricingCard({ plan }: { plan: MarketingPlan }) {
  const firedRef = useRef(false);
  const href = planCtaHref(plan);
  const tierFeatures = getTierSpecificFeatures(plan);
  const inheritance = getInheritanceLabel(plan);

  function firePlanSelected() {
    if (firedRef.current) return;
    firedRef.current = true;
    trackMarketingEvent("plan_selected", { plan_id: plan.id, cta_location: "pricing" });
    if (plan.availability === "available") {
      trackMarketingEvent("start_free_clicked", {
        cta_location: "pricing",
        cta_label: plan.ctaLabel,
      });
    } else {
      trackMarketingEvent("contact_clicked", {
        contact_type: "whatsapp",
        cta_location: "pricing",
      });
    }
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-card p-8 transition-all duration-700 ease-out ${
        plan.highlighted
          ? "border-2 border-brand shadow-[0_2px_24px_rgba(19,132,125,0.12)]"
          : "border border-line"
      }`}
    >
      {/* Badge */}
      {plan.badge && (
        <div className="mb-4">
          <PlanBadge
            label={plan.badge}
            variant={plan.id === "premium" ? "ai-early-access" : "popular"}
          />
        </div>
      )}

      {/* Plan name + price */}
      <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
      <div className="mt-3">
        <p className="text-4xl font-bold text-ink">
          {formatPrice(plan.monthlyPriceAmount, plan.currency)}
        </p>
        <p className="mt-1 text-sm text-ink-soft">per month</p>
      </div>

      {/* Trial */}
      <p className="mt-4 text-sm font-medium text-brand">First month free</p>

      {/* CTA */}
      <div className="mt-6">
        {plan.availability === "available" ? (
          <Link
            href={href}
            onClick={firePlanSelected}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-7 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:bg-brand-hover active:scale-[0.97]"
          >
            {plan.ctaLabel}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={firePlanSelected}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-card px-7 py-3.5 text-base font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor" />
            </svg>
            {plan.ctaLabel}
          </a>
        )}
      </div>

      {/* Inheritance note */}
      {inheritance && (
        <p className="mt-4 text-sm font-medium text-ink">{inheritance}</p>
      )}

      {/* Tier-specific features */}
      <ul className="mt-4 flex-1 space-y-2.5">
        {tierFeatures.map((feat) => (
          <li key={feat.id} className="flex items-start gap-3 text-sm text-ink-soft">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-brand" aria-hidden="true">
              <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {feat.label}
          </li>
        ))}
      </ul>

      {/* Premium AI early access */}
      {plan.aiStatus === "early-access" && (
        <div className="mt-6 rounded-xl border border-line bg-surface-muted px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue">
            Coming soon with AI early access
          </p>
          <ul className="mt-2 space-y-1.5">
            {["AI booking assistant", "Automated customer answers", "AI-assisted enquiries"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-ink-soft">
                <span className="text-muted">◷</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
