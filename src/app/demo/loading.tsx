export default function DemoLoading() {
  return (
    <div className="min-h-screen bg-paper text-ink animate-pulse">
      <main className="flex-1">
        <section className="mx-auto max-w-[1200px] px-6 py-20 sm:py-28">
          <div className="max-w-xl">
            <div className="h-4 w-24 rounded bg-surface-muted" />
            <div className="mt-4 h-10 w-56 rounded bg-surface-muted" />
            <div className="mt-4 h-5 w-full rounded bg-surface-muted" />
            <div className="mt-2 h-5 w-4/5 rounded bg-surface-muted" />
          </div>

          {/* Business card skeletons */}
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col rounded-2xl border border-line bg-card p-6">
                <div className="flex items-start justify-between">
                  <div className="h-5 w-20 rounded-full bg-surface-muted" />
                  <div className="h-6 w-6 rounded bg-surface-muted" />
                </div>
                <div className="mt-5 h-5 w-36 rounded bg-surface-muted" />
                <div className="mt-2 h-4 w-full rounded bg-surface-muted" />
                <div className="mt-5 border-t border-line pt-4">
                  <div className="h-3 w-40 rounded bg-surface-muted" />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-10 w-full rounded-lg bg-surface-muted" />
                  <div className="h-10 w-full rounded-lg bg-surface-muted" />
                  <div className="h-8 w-full rounded bg-surface-muted" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 h-14 w-full rounded-2xl bg-surface-muted" />
        </section>
      </main>
    </div>
  );
}
