import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-ink">Page not found</h1>
      <p className="mt-4 max-w-sm text-ink-soft">
        The page you are looking for doesn&apos;t exist or has moved. Try one of the links below.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper hover:bg-black"
        >
          Home
        </Link>
        <Link
          href="/demo"
          className="rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-ink hover:border-gold/60"
        >
          View demos
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-ink hover:border-gold/60"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
