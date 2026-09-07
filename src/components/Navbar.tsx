import Link from "next/link";
import { DEMO_BUSINESS } from "@/lib/demo";
import AuthLinks from "@/components/AuthLinks";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">
            {DEMO_BUSINESS.name}
          </span>
          <span className="hidden text-xs text-ink-soft sm:inline">
            {DEMO_BUSINESS.tagline.toLowerCase()}
          </span>
        </Link>
        <span className="flex items-center gap-2">
          <AuthLinks />
          <Link
            href="/book"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-black"
          >
            Book Now
          </Link>
        </span>
      </div>
    </header>
  );
}