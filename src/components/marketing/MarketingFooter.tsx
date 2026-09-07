import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5">
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect width="28" height="28" rx="7" fill="#13847D" />
                <path d="M8 10.5C8 9.67 8.67 9 9.5 9H13.5C15.43 9 17 10.57 17 12.5C17 14.43 15.43 16 13.5 16H9.5C8.67 16 8 15.33 8 14.5V10.5Z" fill="white" opacity="0.9" />
                <path d="M12 16L12 19.5C12 20.33 12.67 21 13.5 21H18.5C19.33 21 20 20.33 20 19.5V13.5C20 12.67 19.33 12 18.5 12H12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-lg font-bold tracking-tight text-ink">Kivo</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Simple digital booking and reservations for businesses that need their time back.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm" aria-label="Footer navigation">
            <a href="#product" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Product</a>
            <a href="#solutions" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Solutions</a>
            <a href="#how-it-works" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">How It Works</a>
            <Link href="/login" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Sign In</Link>
            <Link href="/signup" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Get Started</Link>
          </nav>
        </div>

        <div className="mt-10 border-t border-line pt-6">
          <p className="text-xs text-muted">&copy; {new Date().getFullYear()} Kivo. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
