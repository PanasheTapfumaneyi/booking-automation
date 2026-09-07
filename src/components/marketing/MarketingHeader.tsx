"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Solutions", href: "#solutions" },
  { label: "How It Works", href: "#how-it-works" },
];

export default function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#13847D" />
            <path d="M8 10.5C8 9.67 8.67 9 9.5 9H13.5C15.43 9 17 10.57 17 12.5C17 14.43 15.43 16 13.5 16H9.5C8.67 16 8 15.33 8 14.5V10.5Z" fill="white" opacity="0.9" />
            <path d="M12 16L12 19.5C12 20.33 12.67 21 13.5 21H18.5C19.33 21 20 20.33 20 19.5V13.5C20 12.67 19.33 12 18.5 12H12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-xl font-bold tracking-tight text-ink">Kivo</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-2 text-[15px] font-medium text-ink-soft transition-colors duration-150 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-1 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2.5 text-[15px] font-medium text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            Sign In
          </Link>
          <Link
            href="/demo"
            className="rounded-lg px-4 py-2.5 text-[15px] font-medium text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            View Demo
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
          >
            Get Started
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-surface-muted md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 6H17M3 10H17M3 14H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-line bg-paper px-6 pb-6 pt-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-ink-soft transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2.5 text-center text-[15px] font-medium text-ink-soft transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
              onClick={() => setMenuOpen(false)}
            >
              Sign In
            </Link>
            <Link
              href="/demo"
              className="rounded-lg px-3 py-2.5 text-center text-[15px] font-medium text-ink-soft transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
              onClick={() => setMenuOpen(false)}
            >
              View Demo
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
              onClick={() => setMenuOpen(false)}
            >
              Get Started
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
