export default function BusinessLoading() {
  return (
    <div className="min-h-screen bg-paper text-ink animate-pulse">
      <main className="flex-1">
        {/* Hero skeleton */}
        <section className="border-b border-line bg-surface-muted">
          <div className="mx-auto max-w-[1200px] px-6 py-16 sm:py-20">
            <div className="mb-4 h-16 w-16 rounded-xl bg-surface-muted" />
            <div className="h-4 w-28 rounded bg-surface-muted" />
            <div className="mt-4 h-10 w-64 rounded bg-surface-muted" />
            <div className="mt-4 h-5 w-80 rounded bg-surface-muted" />
            <div className="mt-8 flex gap-3">
              <div className="h-12 w-36 rounded-lg bg-surface-muted" />
              <div className="h-12 w-32 rounded-lg bg-surface-muted" />
            </div>
          </div>
        </section>

        {/* Offerings skeleton */}
        <section className="mx-auto max-w-[1200px] px-6 py-14 sm:py-20">
          <div className="h-7 w-48 rounded bg-surface-muted" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col rounded-2xl border border-line bg-card">
                <div className="aspect-video rounded-t-2xl bg-surface-muted" />
                <div className="p-5">
                  <div className="h-5 w-36 rounded bg-surface-muted" />
                  <div className="mt-3 h-4 w-24 rounded bg-surface-muted" />
                  <div className="mt-4 h-10 w-24 rounded-lg bg-surface-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Hours skeleton */}
        <section className="border-t border-line bg-card">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-14 sm:py-16 md:grid-cols-2">
            <div>
              <div className="h-5 w-36 rounded bg-surface-muted" />
              <div className="mt-5 space-y-3">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="flex items-center justify-between border-b border-line pb-2.5">
                    <div className="h-4 w-20 rounded bg-surface-muted" />
                    <div className="h-4 w-24 rounded bg-surface-muted" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="h-5 w-24 rounded bg-surface-muted" />
              <div className="mt-5 space-y-2">
                <div className="h-4 w-32 rounded bg-surface-muted" />
                <div className="h-4 w-48 rounded bg-surface-muted" />
              </div>
              <div className="mt-6 h-11 w-28 rounded-lg bg-surface-muted" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
