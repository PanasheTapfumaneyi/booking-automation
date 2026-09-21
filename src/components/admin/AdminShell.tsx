"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface AdminShellProps {
  children: ReactNode;
}

const NAV_ENTRIES = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "businesses", label: "Businesses", href: "/admin/businesses" },
  { key: "create", label: "Create Business", href: "/admin/create-business" },
  { key: "operations", label: "Operations", href: "/admin/operations" },
  { key: "analytics", label: "Analytics", href: "/admin/analytics" },
  { key: "leads", label: "Leads", href: "/admin/leads" },
  { key: "integrations", label: "Integrations", href: "/admin/integrations" },
];

/**
 * Shared admin console shell — sidebar nav + content area.
 * All /admin/* pages use this to provide consistent navigation.
 * Mobile: horizontal scrollable row. Desktop: fixed left sidebar.
 */
export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:py-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        {/* Sidebar / nav */}
        <aside className="lg:w-52 lg:shrink-0">
          <div className="hidden lg:mb-5 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Admin console
            </p>
          </div>
          <nav
            aria-label="Admin navigation"
            className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:items-stretch lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {NAV_ENTRIES.map((entry) => {
              const active =
                entry.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(entry.href);
              return (
                <Link
                  key={entry.key}
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex shrink-0 items-center rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-blue-soft text-blue-strong"
                      : "text-ink-soft hover:bg-card hover:text-ink",
                  ].join(" ")}
                >
                  {entry.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
