/**
 * Central marketing configuration for the Kivo website.
 *
 * Contact details, pricing, and WhatsApp links live here so they are
 * never scattered across individual components. Every marketing component
 * imports from this single source of truth.
 *
 * Phone and WhatsApp numbers are NOT committed to the repository.
 * Set them via environment variables or fill in the placeholder values
 * below before deploying.
 */

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

/** Business phone number in E.164-ish local format (no + prefix). */
export const CONTACT_PHONE = process.env.KIVO_CONTACT_PHONE ?? "";

/** WhatsApp number in international format without + (e.g. "23057123456"). */
export const CONTACT_WHATSAPP = process.env.KIVO_CONTACT_WHATSAPP ?? "";

/** Prefilled WhatsApp message for prospective clients. */
export const WHATSAPP_MESSAGE =
  "Hi, I'd like to try Kivo for my business.";

/**
 * WhatsApp click-to-chat URL.
 * Returns empty string if no WhatsApp number is configured.
 */
export function whatsappUrl(message?: string): string {
  if (!CONTACT_WHATSAPP) return "";
  const text = message ?? WHATSAPP_MESSAGE;
  return `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

/**
 * Telephone dial URL.
 * Returns empty string if no phone number is configured.
 */
export function telUrl(): string {
  if (!CONTACT_PHONE) return "";
  return `tel:${CONTACT_PHONE.replace(/\s+/g, "")}`;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export const PRICING = {
  /** Human-readable trial period. */
  trialLabel: "First month free",
  /** Monthly price after trial. */
  monthlyPrice: "Rs 1,000/month",
  /** Numeric monthly price for structured use. */
  monthlyPriceAmount: 1000,
  /** Currency. */
  currency: "Rs",
} as const;

// ---------------------------------------------------------------------------
// Featured businesses (homepage showcase)
// ---------------------------------------------------------------------------

export interface FeaturedBusiness {
  slug: string;
  name: string;
  category: string;
  description: string;
  mode: "appointment" | "resource" | "capacity";
  /** Customer-facing mode label. */
  modeLabel: string;
}

export const FEATURED_BUSINESSES: FeaturedBusiness[] = [
  {
    slug: "fade-area",
    name: "Fade Area",
    category: "Barbershop",
    description: "Professional haircuts, beard trims and consultations — booked online.",
    mode: "appointment",
    modeLabel: "Appointments",
  },
  {
    slug: "kivo-drive",
    name: "Kivo Drive",
    category: "Car Rental",
    description: "Browse the fleet, choose your dates and reserve a vehicle instantly.",
    mode: "resource",
    modeLabel: "Rentals",
  },
  {
    slug: "island-surf",
    name: "Island Surf Co.",
    category: "Surf & Equipment Rental",
    description: "Surfboards, paddleboards and gear — available by the day.",
    mode: "resource",
    modeLabel: "Rentals",
  },
  {
    slug: "blue-lagoon",
    name: "Blue Lagoon Swim School",
    category: "Swim Classes",
    description: "Group lessons and kids sessions with live availability.",
    mode: "capacity",
    modeLabel: "Classes & Tours",
  },
];
