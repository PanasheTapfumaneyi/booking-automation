import Link from "next/link";
import AuthLinks from "@/components/AuthLinks";
import AdminNavLink from "@/components/AdminNavLink";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#13847D" />
            <path d="M8 10.5C8 9.67 8.67 9 9.5 9H13.5C15.43 9 17 10.57 17 12.5C17 14.43 15.43 16 13.5 16H9.5C8.67 16 8 15.33 8 14.5V10.5Z" fill="white" opacity="0.9" />
            <path d="M12 16L12 19.5C12 20.33 12.67 21 13.5 21H18.5C19.33 21 20 20.33 20 19.5V13.5C20 12.67 19.33 12 18.5 12H12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-lg font-bold tracking-tight text-ink">Kivo</span>
        </Link>
        <span className="flex items-center gap-3">
          <AdminNavLink />
          <AuthLinks />
        </span>
      </div>
    </header>
  );
}
