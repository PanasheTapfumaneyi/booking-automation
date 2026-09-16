import Link from "next/link";
import { isPlatformAdmin } from "@/lib/server/auth";

/**
 * Server component — renders an "Admin" link in the navbar only when the
 * current session user is a platform administrator. Renders nothing for
 * ordinary users (no hint that the admin route exists).
 */
export default async function AdminNavLink() {
  const isAdmin = await isPlatformAdmin().catch(() => false);
  if (!isAdmin) return null;
  return (
    <Link
      href="/admin"
      className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
    >
      Admin
    </Link>
  );
}
