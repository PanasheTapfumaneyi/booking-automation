import Link from "next/link";

export default function BusinessFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-medium text-ink-soft transition-colors duration-150 hover:text-ink"
        >
          Powered by
          <svg width="14" height="14" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#13847D" />
            <path d="M8 10.5C8 9.67 8.67 9 9.5 9H13.5C15.43 9 17 10.57 17 12.5C17 14.43 15.43 16 13.5 16H9.5C8.67 16 8 15.33 8 14.5V10.5Z" fill="white" opacity="0.9" />
            <path d="M12 16L12 19.5C12 20.33 12.67 21 13.5 21H18.5C19.33 21 20 20.33 20 19.5V13.5C20 12.67 19.33 12 18.5 12H12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="font-bold text-ink">Kivo</span>
        </Link>
      </div>
    </footer>
  );
}
