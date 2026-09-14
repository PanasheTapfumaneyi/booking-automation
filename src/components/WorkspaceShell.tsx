"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface WorkspaceShellProps {
  businessId: string;
  businessName: string;
  businessSlug: string | null;
}

interface NavEntry {
  key: string;
  label: string;
  href: string;
  match: (path: string) => boolean;
}

function isActive(match: (path: string) => boolean, pathname: string): boolean {
  return match(pathname);
}

export default function WorkspaceShell({
  businessId,
  businessName,
  businessSlug,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const q = `?business=${businessId}`;

  const entries: NavEntry[] = [
    {
      key: "overview",
      label: "Overview",
      href: `/dashboard${q}`,
      match: (p) => p === "/dashboard",
    },
    {
      key: "bookings",
      label: "Bookings",
      href: `/dashboard/bookings${q}`,
      match: (p) => p.startsWith("/dashboard/bookings"),
    },
  ];

  const isSettingsActive = pathname === "/settings";

  return (
    <aside className="lg:w-56 lg:shrink-0">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-soft">Workspace</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">{businessName}</p>
      </div>
      <nav aria-label="Workspace" className="flex flex-wrap items-center gap-1 lg:flex-col lg:items-stretch">
        {entries.map((entry) => {
          const active = isActive(entry.match, pathname);
          return (
            <Link
              key={entry.key}
              href={entry.href}
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-ink text-paper"
                  : "text-ink-soft hover:bg-card hover:text-ink",
              ].join(" ")}
            >
              {entry.label}
            </Link>
          );
        })}
        <Link
          href={`/settings${q}`}
          aria-current={isSettingsActive ? "page" : undefined}
          className={[
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isSettingsActive
              ? "bg-ink text-paper"
              : "text-ink-soft hover:bg-card hover:text-ink",
          ].join(" ")}
        >
          Settings
        </Link>
        {businessSlug && (
          <Link
            href={`/business/${businessSlug}`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-card hover:text-ink"
          >
            View public page
          </Link>
        )}
      </nav>
    </aside>
  );
}