/**
 * Single source of truth for site-wide SEO and metadata configuration.
 *
 * Every page, sitemap, robots and structured-data entry imports from here.
 * Production MUST set NEXT_PUBLIC_SITE_URL to the canonical www URL.
 */
export const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kivoconsulting.site";
  return raw.replace(/\/+$/, "");
})();

export const SITE_NAME = "Kivo";

export const SITE_LOCALE = "en-MU";

export const DEFAULT_TITLE =
  "Online Booking System for Mauritian Businesses | Kivo";

export const DEFAULT_DESCRIPTION =
  "Kivo gives Mauritian businesses a professional booking website, automated WhatsApp reminders, Google Calendar syncing and simple booking management.";

export const OG_IMAGE = `${SITE_URL}/og.png`;

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
