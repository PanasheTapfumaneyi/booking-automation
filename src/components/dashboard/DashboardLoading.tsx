/**
 * Shared loading skeleton for authenticated routes. Each dashboard
 * segment gets a loading.tsx that renders this, so navigation between
 * Overview / Bookings / Settings never flashes a blank page — the
 * skeleton preserves the shell layout dimensions.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:py-10" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <div className="hidden lg:block lg:w-60 lg:shrink-0" aria-hidden="true">
          <div className="h-3 w-20 animate-pulse rounded bg-ink/10" />
          <div className="mt-2 h-4 w-32 animate-pulse rounded bg-ink/10" />
          <div className="mt-4 flex flex-col gap-1">
            <div className="h-10 animate-pulse rounded-xl bg-ink/10" />
            <div className="h-10 animate-pulse rounded-xl bg-ink/10" />
            <div className="h-10 animate-pulse rounded-xl bg-ink/10" />
          </div>
        </div>
        <div className="min-w-0 flex-1" aria-hidden="true">
          <div className="h-4 w-48 animate-pulse rounded bg-ink/10" />
          <div className="mt-2 h-8 w-64 animate-pulse rounded-lg bg-ink/10" />
          <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-ink/10" />
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            <div className="h-[88px] animate-pulse rounded-2xl bg-ink/10" />
            <div className="h-[88px] animate-pulse rounded-2xl bg-ink/10" />
            <div className="h-[88px] animate-pulse rounded-2xl bg-ink/10" />
          </div>
          <div className="mt-8 h-6 w-32 animate-pulse rounded bg-ink/10" />
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-ink/10" />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <div className="h-[68px] animate-pulse rounded-xl bg-ink/10" />
            <div className="h-[68px] animate-pulse rounded-xl bg-ink/10" />
            <div className="h-[68px] animate-pulse rounded-xl bg-ink/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
