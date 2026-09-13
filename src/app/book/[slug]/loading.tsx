export default function BookLoading() {
  return (
    <div className="min-h-screen bg-paper text-ink animate-pulse">
      <main className="mx-auto max-w-[1200px] px-6 py-10 sm:py-14">
        {/* Step indicator skeleton */}
        <div className="flex items-center gap-3 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-surface-muted" />
              <div className="h-4 w-16 rounded bg-surface-muted hidden sm:block" />
              {i < 3 && <div className="h-px w-8 bg-line" />}
            </div>
          ))}
        </div>

        {/* Service cards skeleton */}
        <div className="h-7 w-48 rounded bg-surface-muted" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col rounded-2xl border border-line bg-card p-5">
              <div className="h-5 w-32 rounded bg-surface-muted" />
              <div className="mt-2 h-4 w-20 rounded bg-surface-muted" />
              <div className="mt-2 h-3 w-40 rounded bg-surface-muted" />
              <div className="mt-4 h-10 w-24 rounded-lg bg-surface-muted" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
