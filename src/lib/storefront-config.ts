/**
 * Storefront 2.0 shared vocabulary (pure — safe for client components).
 *
 * Single source of truth for controlled values so dashboard UI can never
 * drift from server validation. Server logic lives in
 * `@/lib/server/storefront`, which re-exports these.
 */

/** Presentation categories. Null/unknown = uncategorized (renders defaults). */
export const STOREFRONT_CATEGORIES = [
  "barber",
  "beauty_salon",
  "nail_salon",
  "spa",
  "tattoo_studio",
  "clinic",
  "consultant",
  "fitness",
  "other",
] as const;

export type StorefrontCategory = (typeof STOREFRONT_CATEGORIES)[number];

/** Pure membership check shared by server validation and UI. */
export function isStorefrontCategory(value: unknown): value is StorefrontCategory {
  return typeof value === "string" && (STOREFRONT_CATEGORIES as readonly string[]).includes(value);
}

export const STOREFRONT_CATEGORY_LABELS: Record<string, string> = {
  barber: "Barbershop",
  beauty_salon: "Beauty salon",
  nail_salon: "Nail salon",
  spa: "Spa",
  tattoo_studio: "Tattoo studio",
  clinic: "Clinic",
  consultant: "Consultant",
  fitness: "Fitness",
  other: "Other",
};

/** Display-only amenity chips. */
export const STOREFRONT_AMENITIES = [
  "Parking",
  "Wi-Fi",
  "Air conditioning",
  "Card payments",
  "Wheelchair access",
  "Kid friendly",
  "Pet friendly",
  "Outdoor seating",
] as const;

/** Section keys usable in `section_order` overrides. */
export const STOREFRONT_SECTIONS = [
  "hero",
  "services",
  "gallery",
  "team",
  "about",
  "hours",
  "location",
  "reviews",
  "contact",
] as const;

/** Storefront template styles. Only the appointment template ships in V1. */
export const STOREFRONT_TEMPLATES = ["appointment_modern"] as const;

/** Social networks accepted in `social_links` (constrained JSON object). */
export const SOCIAL_NETWORKS = [
  "instagram",
  "facebook",
  "tiktok",
  "website",
  "whatsapp",
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  website: "Website",
  whatsapp: "WhatsApp",
};

export type SocialLinks = Partial<Record<SocialNetwork, string>>;

/**
 * Curated accent colours. Every preset keeps white text readable
 * (contrast ≥ 4.5:1, verified in storefront-config tests) so owners
 * cannot create unreadable combinations from the presets.
 */
export const ACCENT_PRESETS: Array<{ name: string; value: string }> = [
  { name: "Kivo teal", value: "#13847D" },
  { name: "Deep blue", value: "#15547D" },
  { name: "Forest", value: "#2F5D50" },
  { name: "Terracotta", value: "#9A3B26" },
  { name: "Plum", value: "#5B2D6E" },
  { name: "Gold", value: "#8A6500" },
  { name: "Charcoal", value: "#333333" },
  { name: "Crimson", value: "#B02A37" },
];

/** Minimum white-text contrast for custom accent colours. */
export const MIN_ACCENT_CONTRAST = 3;

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio of a hex colour against white (null when invalid). */
export function contrastAgainstWhite(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return (1.05) / (luminance(rgb) + 0.05);
}

/** True when a custom accent keeps white text readable. */
export function isReadableAccent(hex: string): boolean {
  const ratio = contrastAgainstWhite(hex);
  return ratio !== null && ratio >= MIN_ACCENT_CONTRAST;
}
