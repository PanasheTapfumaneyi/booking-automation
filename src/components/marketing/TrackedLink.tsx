"use client";

/**
 * Marketing click-tracking primitives.
 *
 * TrackedLink fires a first-party analytics event on click WITHOUT
 * intercepting navigation: no preventDefault, no await — the browser
 * navigates normally while sendBeacon delivers the event. If analytics
 * fails or is disabled, the link behaves exactly like a plain anchor.
 */
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

interface TrackedLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  eventName: string;
  eventProps?: Record<string, unknown>;
  children: ReactNode;
}

export function TrackedLink({
  href,
  eventName,
  eventProps,
  onClick,
  children,
  ...rest
}: TrackedLinkProps) {
  return (
    <Link
      href={href}
      {...rest}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        trackMarketingEvent(eventName, eventProps);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}

/**
 * One-shot page-view beacon for server-rendered marketing pages.
 * Mount once per page (homepage, demo, signup, login).
 */
import { useEffect } from "react";

export function TrackMarketingPageView() {
  useEffect(() => {
    trackMarketingEvent("marketing_page_viewed", {});
  }, []);
  return null;
}
