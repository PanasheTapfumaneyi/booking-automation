import { DEMO_BUSINESS } from "@/lib/demo";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-card">
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>
          {DEMO_BUSINESS.name} · {DEMO_BUSINESS.address}
        </p>
        <p>{DEMO_BUSINESS.phone}</p>
      </div>
    </footer>
  );
}