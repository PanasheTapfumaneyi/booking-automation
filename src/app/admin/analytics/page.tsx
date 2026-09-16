import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import {
  getDeviceBreakdown,
  getFeaturedClicks,
  getMarketingFunnel,
  getMarketingOverview,
  getSetupSplit,
  getTopCtaLocations,
  getTopSources,
  type MarketingRange,
} from "@/lib/server/marketing-analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marketing analytics",
  description: "Acquisition and conversion analytics for Kivo.",
  robots: { index: false, follow: false },
};

const RANGES: Array<{ key: MarketingRange; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 rounded-full bg-blue/70 align-middle"
      style={{ width: `${Math.min(width, 120)}px` }}
    />
  );
}

/**
 * Platform-admin marketing analytics. First-party aggregates from
 * `marketing_events` — no third-party dashboard needed for the basics.
 * Anonymous sessions only; normal business owners have no access.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePlatformAdmin();
  const query = await searchParams;
  const range: MarketingRange =
    query.range === "today" || query.range === "30d" ? query.range : "7d";
  const db = getSupabase();

  const [overview, funnel, sources, ctaLocations, featured, split, devices] =
    await Promise.all([
      getMarketingOverview(range, db),
      getMarketingFunnel(range, db),
      getTopSources(range, db),
      getTopCtaLocations(range, db),
      getFeaturedClicks(range, db),
      getSetupSplit(range, db),
      getDeviceBreakdown(range, db),
    ]);

  const rangeHref = (key: MarketingRange) => `/admin/analytics?range=${key}`;
  const maxSource = Math.max(0, ...sources.map((s) => s.count));
  const maxCta = Math.max(0, ...ctaLocations.map((c) => c.count));
  const maxFeatured = Math.max(0, ...featured.map((f) => f.total));
  const setupTotal = split.managed + split.self;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Marketing analytics
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Is the marketing working? First-party, anonymous — no third party needed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((entry) => (
          <Link
            key={entry.key}
            href={rangeHref(entry.key)}
            aria-current={range === entry.key ? "page" : undefined}
            className={[
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              range === entry.key
                ? "border-blue bg-blue-soft font-semibold text-blue-strong"
                : "border-line bg-card text-ink-soft hover:text-ink",
            ].join(" ")}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
        {[
          { label: "Visitors", value: String(overview.visitors) },
          { label: "Start Free clicks", value: String(overview.startFreeClicks) },
          { label: "Signup starts", value: String(overview.signupStarts) },
          { label: "Accounts created", value: String(overview.accountsCreated) },
          { label: "Setup completed", value: String(overview.setupCompleted) },
          {
            label: "Account conversion",
            value: `${(overview.conversionRate * 100).toFixed(1)}%`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex min-h-[88px] flex-col justify-center rounded-2xl border border-line bg-card px-4 py-3"
          >
            <span className="text-2xl font-semibold tabular-nums text-blue-ink">
              {stat.value}
            </span>
            <span className="mt-1 text-xs text-ink-soft">{stat.label}</span>
          </div>
        ))}
      </div>

      <section aria-label="Conversion funnel">
        <h2 className="text-lg font-semibold tracking-tight">Funnel / drop-off</h2>
        {funnel.every((stage) => stage.count === 0) ? (
          <p className="mt-3 text-sm text-ink-soft">
            No marketing activity in this range yet.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col gap-2">
            {funnel.map((stage, index) => {
              const previous = index === 0 ? null : funnel[index - 1].count;
              const rate =
                previous !== null && previous > 0
                  ? `${((stage.count / previous) * 100).toFixed(0)}%`
                  : index === 0
                    ? "—"
                    : "0%";
              return (
                <li
                  key={stage.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{stage.label}</span>{" "}
                    <span className="text-sm text-ink-soft tabular-nums">
                      {stage.count}
                      {index > 0 && ` · ${rate} of previous`}
                    </span>
                  </span>
                  <Bar value={stage.count} max={Math.max(...funnel.map((s) => s.count), 1)} />
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Acquisition sources">
          <h2 className="text-lg font-semibold tracking-tight">Top acquisition sources</h2>
          {sources.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No attributed visits yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {sources.map((entry) => (
                <li
                  key={entry.source}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-sm"
                >
                  <span className="font-medium capitalize">{entry.source}</span>
                  <span className="flex items-center gap-2 tabular-nums text-ink-soft">
                    {entry.count} <Bar value={entry.count} max={maxSource} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Devices">
          <h2 className="text-lg font-semibold tracking-tight">Devices</h2>
          {devices.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No data yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {devices.map((entry) => (
                <li
                  key={entry.device}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-sm"
                >
                  <span className="font-medium capitalize">{entry.device}</span>
                  <span className="tabular-nums text-ink-soft">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-label="CTA locations">
        <h2 className="text-lg font-semibold tracking-tight">Top CTA locations</h2>
        {ctaLocations.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No CTA clicks yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {ctaLocations.map((entry) => (
              <li
                key={entry.location}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-sm"
              >
                <span className="font-medium">{entry.location}</span>
                <span className="flex items-center gap-2 tabular-nums text-ink-soft">
                  {entry.count} <Bar value={entry.count} max={maxCta} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Featured business clicks">
          <h2 className="text-lg font-semibold tracking-tight">Featured business clicks</h2>
          {featured.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No featured clicks yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {featured.map((entry) => (
                <li
                  key={entry.slug}
                  className="rounded-xl border border-line bg-card px-4 py-2.5 text-sm"
                >
                  <span className="font-medium">{entry.slug}</span>
                  <span className="mt-0.5 block tabular-nums text-ink-soft">
                    {entry.total} total · {entry.bookNow} book now · {entry.viewBusiness} view business
                  </span>
                  <Bar value={entry.total} max={maxFeatured} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Managed versus self setup">
          <h2 className="text-lg font-semibold tracking-tight">Managed vs self setup</h2>
          {setupTotal === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No setup choices yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5">
                <span className="font-medium">Set it up for me</span>
                <span className="tabular-nums text-ink-soft">
                  {split.managed} · {((split.managed / setupTotal) * 100).toFixed(0)}%
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5">
                <span className="font-medium">Configure it now</span>
                <span className="tabular-nums text-ink-soft">
                  {split.self} · {((split.self / setupTotal) * 100).toFixed(0)}%
                </span>
              </li>
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
