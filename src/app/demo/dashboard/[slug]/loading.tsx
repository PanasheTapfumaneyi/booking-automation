export default function DemoDashboardLoading() {
  return (
    <div className="min-h-full bg-paper text-ink animate-pulse">
      {/* Demo banner */}
      <div className="border-b border-line bg-surface-muted">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-4 w-64 rounded bg-surface-muted" />
          <div className="h-4 w-40 rounded bg-surface-muted" />
        </div>
      </div>

      <main className="mx-auto max-w-[1200px] px-6 py-10 sm:py-14">
        {/* Header skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="h-3 w-20 rounded bg-surface-muted" />
            <div className="mt-2 h-8 w-64 rounded bg-surface-muted" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-32 rounded-lg bg-surface-muted" />
            <div className="h-10 w-36 rounded-lg bg-surface-muted" />
          </div>
        </div>

        {/* Stat cards skeleton */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-line bg-card px-4 py-4 text-center sm:px-6">
              <div className="mx-auto h-3 w-12 rounded bg-surface-muted" />
              <div className="mx-auto mt-2 h-8 w-10 rounded bg-surface-muted" />
              <div className="mx-auto mt-1 h-3 w-14 rounded bg-surface-muted" />
            </div>
          ))}
        </div>

        {/* Booking rows skeleton */}
        <div className="mt-10">
          <div className="h-5 w-40 rounded bg-surface-muted" />
          <div className="mt-4 space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
                <div className="h-2 w-2 shrink-0 rounded-full bg-surface-muted" />
                <div className="h-4 w-12 shrink-0 rounded bg-surface-muted" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-36 rounded bg-surface-muted" />
                  <div className="mt-1 h-3 w-28 rounded bg-surface-muted" />
                </div>
                <div className="h-5 w-14 shrink-0 rounded-full bg-surface-muted" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
