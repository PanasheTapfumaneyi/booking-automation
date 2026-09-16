"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface DashboardShellProps {
  businessId: string;
  businessName: string;
  businessSlug: string | null;
  children: ReactNode;
}

function OverviewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function BookingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 1v3M11 1v3M1.5 6.5h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function StorefrontIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h9A1.5 1.5 0 0 1 14 5.5V12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V5.5Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 5.5C2 4 3 2.5 4.5 2.5c1 0 1.5.8 2.5.8s1.5-.8 2.5-.8 1.5.8 2.5.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 8.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IntegrationsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="4" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 8h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Shared authenticated-app shell: sidebar navigation + content column.
 * Used by /dashboard, /dashboard/bookings*, and /settings so the whole
 * authenticated product feels like one application.
 *
 * Mobile: the nav becomes a horizontal scrollable row above the content —
 * never a squeezed desktop sidebar, never horizontal page overflow.
 */
export default function DashboardShell({
  businessId,
  businessName,
  businessSlug,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const q = `?business=${businessId}`;

  const entries = [
    {
      key: "overview",
      label: "Overview",
      href: `/dashboard${q}`,
      icon: <OverviewIcon />,
      active: pathname === "/dashboard",
    },
    {
      key: "bookings",
      label: "Bookings",
      href: `/dashboard/bookings${q}`,
      icon: <BookingsIcon />,
      active: pathname.startsWith("/dashboard/bookings"),
    },
    {
      key: "storefront",
      label: "Storefront",
      href: `/dashboard/storefront${q}`,
      icon: <StorefrontIcon />,
      active: pathname === "/dashboard/storefront",
    },
    {
      key: "settings",
      label: "Settings",
      href: `/settings${q}`,
      icon: <SettingsIcon />,
      active: pathname === "/settings",
    },
    {
      key: "integrations",
      label: "Integrations",
      href: `/dashboard/integrations${q}`,
      icon: <IntegrationsIcon />,
      active: pathname === "/dashboard/integrations",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:py-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <aside className="lg:w-60 lg:shrink-0">
          <div className="hidden lg:mb-4 lg:block">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-soft">
              Workspace
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink">
              {businessName}
            </p>
          </div>
          <nav
            aria-label="Workspace"
            className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:items-stretch lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {entries.map((entry) => (
              <Link
                key={entry.key}
                href={entry.href}
                aria-current={entry.active ? "page" : undefined}
                className={[
                  "flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  entry.active
                    ? "bg-blue-soft text-blue-strong"
                    : "text-ink-soft hover:bg-card hover:text-ink",
                ].join(" ")}
              >
                <span aria-hidden="true" className={entry.active ? "text-blue" : "text-muted"}>
                  {entry.icon}
                </span>
                {entry.label}
              </Link>
            ))}
            {businessSlug && (
              <Link
                href={`/business/${businessSlug}`}
                className="flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-card hover:text-ink"
              >
                <span aria-hidden="true" className="text-muted">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M6.5 3.5H3.5v9h9V9.5M9 2.5h4.5V7M13.2 2.8L7.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                View public page
              </Link>
            )}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
