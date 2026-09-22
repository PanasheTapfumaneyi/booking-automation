/**
 * Feature comparison table — server-compatible, no client state.
 *
 * Derives rows from the shared feature catalogue. Used on /pricing.
 */
import {
  PLANS,
  AI_FEATURES,
  formatPrice,
  getFeature,
  type MarketingPlan,
} from "@/lib/marketing-config";

interface FeatureComparisonProps {
  plans?: readonly MarketingPlan[];
}

export default function FeatureComparison({ plans = PLANS }: FeatureComparisonProps) {
  // All unique feature IDs across all plans, preserving catalogue order
  const allFeatureIds = [...new Set(plans.flatMap((p) => p.featureIds))];
  const rows = allFeatureIds.map(getFeature).filter((f): f is { id: string; label: string } => f !== undefined);

  return (
    <section className="bg-surface-muted">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
        <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.1] tracking-tight text-ink">
          Compare plans
        </h2>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-soft">
          See what&apos;s included in each plan.
        </p>

        {/* Desktop table */}
        <div className="mt-10 hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="w-1/2 py-4 pr-4 font-semibold text-ink">Feature</th>
                {plans.map((plan) => (
                  <th key={plan.id} className="w-1/6 py-4 px-4 text-center">
                    <span className="font-semibold text-ink">{plan.name}</span>
                    <span className="mt-1 block text-xs text-ink-soft">
                      {formatPrice(plan.monthlyPriceAmount, plan.currency)}/mo
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((feat) => (
                <tr key={feat.id} className="border-b border-line/60">
                  <td className="py-3.5 pr-4 text-ink-soft">{feat.label}</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="py-3.5 px-4 text-center">
                      {plan.featureIds.includes(feat.id) ? (
                        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="mx-auto text-brand" aria-label={`Included in ${plan.name}`}>
                          <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {/* AI features — coming soon */}
              {AI_FEATURES.length > 0 && (
                <>
                  <tr>
                    <td colSpan={plans.length + 1} className="pt-6 pb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue">
                        Coming soon with AI early access
                      </p>
                    </td>
                  </tr>
                  {AI_FEATURES.map((feat) => (
                    <tr key={feat.id} className="border-b border-line/60">
                      <td className="py-3.5 pr-4 text-ink-soft">{feat.label}</td>
                      {plans.map((plan) => (
                        <td key={plan.id} className="py-3.5 px-4 text-center">
                          {plan.aiStatus === "early-access" ? (
                            <span className="text-xs text-blue font-medium">Coming soon</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked list */}
        <div className="mt-8 space-y-6 lg:hidden">
          {rows.map((feat) => (
            <div key={feat.id}>
              <p className="text-sm font-medium text-ink">{feat.label}</p>
              <div className="mt-2 flex gap-4">
                {plans.map((plan) => (
                  <div key={plan.id} className="flex items-center gap-1.5 text-xs text-ink-soft">
                    {plan.featureIds.includes(feat.id) ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-brand" aria-label={`Included in ${plan.name}`}>
                        <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    {plan.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {/* AI features mobile */}
          {AI_FEATURES.length > 0 && (
            <div className="pt-4 border-t border-line">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue mb-3">
                Coming soon with AI early access
              </p>
              {AI_FEATURES.map((feat) => (
                <div key={feat.id} className="flex items-center gap-2 text-xs text-ink-soft mb-1.5">
                  <span className="text-muted">◷</span>
                  {feat.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
