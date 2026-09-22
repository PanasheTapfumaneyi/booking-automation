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

/** Premium WhatsApp message — high-touch consultation. */
export const PREMIUM_WHATSAPP_MESSAGE =
  "Hi, I'm interested in Kivo Premium and AI early access. Could you tell me more?";

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
// Pricing — types
// ---------------------------------------------------------------------------

/** All plan IDs. */
export type PlanId = "base" | "plus" | "premium";

/** Plan IDs valid for the /signup query parameter (Premium uses WhatsApp). */
export type SignupPlanId = "base" | "plus";

/** Availability status. */
export type PlanAvailability = "available" | "contact";

/** AI feature lifecycle status. */
export type PlanAiStatus = "early-access" | null;

/** A single feature in the catalogue. */
export interface PlanFeature {
  id: string;
  label: string;
}

/** A marketing plan entry. */
export interface MarketingPlan {
  id: PlanId;
  name: string;
  monthlyPriceAmount: number;
  currency: string;
  availability: PlanAvailability;
  aiStatus: PlanAiStatus;
  highlighted: boolean;
  badge?: string;
  ctaLabel: string;
  ctaHref: string;
  featureIds: string[];
}

// ---------------------------------------------------------------------------
// Pricing — feature catalogue
// ---------------------------------------------------------------------------

/** All features, keyed by ID. Single source of truth for cards + comparison. */
export const FEATURES: readonly PlanFeature[] = [
  // Base features
  { id: "booking-website", label: "Professional booking website" },
  { id: "online-bookings", label: "Online bookings 24/7" },
  { id: "dashboard", label: "Booking-management dashboard" },
  { id: "rescheduling", label: "Customer rescheduling and cancellation" },
  { id: "whatsapp-confirmations", label: "Unlimited WhatsApp confirmations and reminders" },
  { id: "google-calendar", label: "Google Calendar integration" },
  { id: "booking-modes", label: "Appointment, rental or capacity booking mode" },
  { id: "setup", label: "Services, pricing and availability setup" },
  { id: "initial-setup", label: "Initial setup handled by Kivo" },
  { id: "ongoing-support", label: "Standard ongoing support and software updates" },
  // Plus additions
  { id: "seo-storefront", label: "Search-optimised business storefront" },
  { id: "seo-content", label: "Custom SEO-focused storefront descriptions and metadata" },
  { id: "gbp-setup", label: "Google Business Profile setup assistance" },
  { id: "gbp-connect", label: "Help connecting storefront to Google profile" },
  { id: "seo-improvements", label: "Ongoing storefront and SEO improvements" },
  { id: "insights", label: "Booking and storefront performance insights" },
  { id: "priority-updates", label: "Priority help updating services, prices and availability" },
  { id: "priority-support", label: "Priority support" },
  // Premium additions
  { id: "advanced-insights", label: "Advanced business and booking insights" },
  { id: "priority-onboarding", label: "Dedicated priority onboarding" },
  { id: "workflow-consultation", label: "Custom workflow consultation" },
  { id: "automation-consultation", label: "Custom automation consultation" },
  { id: "early-access-features", label: "Early access to new Kivo automation features" },
  { id: "dedicated-support", label: "Dedicated priority support" },
] as const;

/** Premium AI features — coming soon, separate from the main catalogue. */
export const AI_FEATURES: readonly PlanFeature[] = [
  { id: "ai-booking-assistant", label: "AI booking assistant" },
  { id: "ai-auto-answers", label: "Automated answers to common customer questions" },
  { id: "ai-lead-enquiries", label: "AI-assisted booking and lead enquiries" },
  { id: "ai-summaries", label: "Smarter booking summaries" },
  { id: "ai-recommendations", label: "AI-powered business recommendations" },
] as const;

// ---------------------------------------------------------------------------
// Pricing — plans
// ---------------------------------------------------------------------------

export const PLANS: readonly MarketingPlan[] = [
  {
    id: "base",
    name: "Base",
    monthlyPriceAmount: 900,
    currency: "Rs",
    availability: "available",
    aiStatus: null,
    highlighted: false,
    ctaLabel: "Start your free month",
    ctaHref: "/signup?plan=base",
    featureIds: [
      "booking-website", "online-bookings", "dashboard", "rescheduling",
      "whatsapp-confirmations", "google-calendar", "booking-modes",
      "setup", "initial-setup", "ongoing-support",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    monthlyPriceAmount: 1400,
    currency: "Rs",
    availability: "available",
    aiStatus: null,
    highlighted: true,
    badge: "Most popular",
    ctaLabel: "Start your free month",
    ctaHref: "/signup?plan=plus",
    featureIds: [
      "booking-website", "online-bookings", "dashboard", "rescheduling",
      "whatsapp-confirmations", "google-calendar", "booking-modes",
      "setup", "initial-setup", "ongoing-support",
      "seo-storefront", "seo-content", "gbp-setup", "gbp-connect",
      "seo-improvements", "insights", "priority-updates", "priority-support",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    monthlyPriceAmount: 2400,
    currency: "Rs",
    availability: "contact",
    aiStatus: "early-access",
    highlighted: false,
    badge: "AI early access",
    ctaLabel: "Contact us on WhatsApp",
    ctaHref: "",
    featureIds: [
      "booking-website", "online-bookings", "dashboard", "rescheduling",
      "whatsapp-confirmations", "google-calendar", "booking-modes",
      "setup", "initial-setup", "ongoing-support",
      "seo-storefront", "seo-content", "gbp-setup", "gbp-connect",
      "seo-improvements", "insights", "priority-updates", "priority-support",
      "advanced-insights", "priority-onboarding", "workflow-consultation",
      "automation-consultation", "early-access-features", "dedicated-support",
    ],
  },
];

// ---------------------------------------------------------------------------
// Pricing — helpers
// ---------------------------------------------------------------------------

/** All valid plan IDs. */
export const VALID_PLAN_IDS: readonly PlanId[] = ["base", "plus", "premium"];

/** Plan IDs valid for /signup query parameter. */
export const VALID_SIGNUP_PLAN_IDS: readonly SignupPlanId[] = ["base", "plus"];

/** Whether a string is a valid PlanId. */
export function isValidPlanId(value: string | null | undefined): value is PlanId {
  return typeof value === "string" && (VALID_PLAN_IDS as readonly string[]).includes(value);
}

/** Whether a string is a valid signup plan ID (excludes premium). */
export function isValidSignupPlanId(value: string | null | undefined): value is SignupPlanId {
  return typeof value === "string" && (VALID_SIGNUP_PLAN_IDS as readonly string[]).includes(value);
}

/** Format a price with en-MU locale. */
export function formatPrice(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-MU")}`;
}

/** Resolve a plan's CTA href (Premium's is derived at runtime from WhatsApp). */
export function planCtaHref(plan: MarketingPlan): string {
  if (plan.ctaHref) return plan.ctaHref;
  return whatsappUrl(PREMIUM_WHATSAPP_MESSAGE);
}

/** Look up a feature by ID from the catalogue. */
export function getFeature(id: string): PlanFeature | undefined {
  return FEATURES.find((f) => f.id === id);
}

/** Get all features for a plan, resolved from the catalogue. */
export function getPlanFeatures(plan: MarketingPlan): PlanFeature[] {
  return plan.featureIds.map(getFeature).filter((f): f is PlanFeature => f !== undefined);
}

/**
 * Get tier-specific features — features in this plan but not in the
 * previous tier. Used for card display to show what's new.
 */
export function getTierSpecificFeatures(
  plan: MarketingPlan,
  allPlans: readonly MarketingPlan[] = PLANS,
): PlanFeature[] {
  const idx = allPlans.findIndex((p) => p.id === plan.id);
  if (idx <= 0) {
    // Base or first plan — show all its features
    return getPlanFeatures(plan);
  }
  const prevPlan = allPlans[idx - 1];
  const prevIds = new Set(prevPlan.featureIds);
  return plan.featureIds
    .filter((id) => !prevIds.has(id))
    .map(getFeature)
    .filter((f): f is PlanFeature => f !== undefined);
}

/**
 * Get the label for the "everything in X" inheritance note.
 * Returns null for Base (no previous tier).
 */
export function getInheritanceLabel(
  plan: MarketingPlan,
  allPlans: readonly MarketingPlan[] = PLANS,
): string | null {
  const idx = allPlans.findIndex((p) => p.id === plan.id);
  if (idx <= 0) return null;
  return `Everything in ${allPlans[idx - 1].name}`;
}

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
