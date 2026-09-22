/**
 * Storefront 2.0 data foundation (server-only).
 *
 * Presentation layer beside the booking engine: storefront configuration,
 * gallery, public team profiles, and legitimate reviews. All reads/writes
 * go through the service-role client; routes enforce owner membership
 * before calling any write helper here.
 *
 * Backwards compatibility: every read tolerates missing rows (a business
 * with no storefront data renders today's page). Nothing here touches
 * bookings, services, availability, tokens, or integrations.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import { ApiError } from "@/lib/server/errors";

type DbLike = Pick<SupabaseClient, "from" | "rpc">;

function serviceDb(db?: DbLike): SupabaseClient {
  return (db ?? getSupabase()) as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Vocabulary (controlled strings, validated in app code — not PG enums)
// ---------------------------------------------------------------------------

import {
  SOCIAL_NETWORKS,
  STOREFRONT_AMENITIES,
  STOREFRONT_SECTIONS,
  STOREFRONT_TEMPLATES,
  isReadableAccent,
  isStorefrontCategory,
  type SocialLinks,
} from "@/lib/storefront-config";

export {
  SOCIAL_NETWORKS,
  STOREFRONT_AMENITIES,
  STOREFRONT_CATEGORIES,
  STOREFRONT_SECTIONS,
  STOREFRONT_TEMPLATES,
  type SocialLinks,
} from "@/lib/storefront-config";

/** Validated category or null (clears). Throws 400 on unknown values. */
export function validateCategory(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") {
    throw new ApiError(400, "VALIDATION", "That business category isn't valid.");
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (!isStorefrontCategory(trimmed)) {
    throw new ApiError(400, "VALIDATION", "That business category isn't valid.");
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface StorefrontRow {
  business_id: string;
  template: string;
  headline: string | null;
  subheadline: string | null;
  hero_image_url: string | null;
  show_gallery: boolean;
  show_team: boolean;
  show_reviews: boolean;
  show_about: boolean;
  show_hours: boolean;
  show_location: boolean;
  show_social: boolean;
  social_links: SocialLinks;
  amenities: string[];
  section_order: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface GalleryRow {
  id: string;
  business_id: string;
  image_url: string;
  caption: string | null;
  alt_text: string | null;
  sort_order: number;
  is_featured: boolean;
  created_at: string;
}

export interface TeamRow {
  id: string;
  business_id: string;
  member_user_id: string | null;
  name: string;
  role: string | null;
  bio: string | null;
  photo_url: string | null;
  visible: boolean;
  bookable: boolean;
  sort_order: number;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  business_id: string;
  source: string;
  external_id: string | null;
  reviewer_name: string | null;
  rating: number | null;
  body: string | null;
  review_date: string | null;
  visible: boolean;
  created_at: string;
}

export interface StorefrontBundle {
  storefront: StorefrontRow | null;
  gallery: GalleryRow[];
  team: TeamRow[];
  reviews: ReviewRow[];
}

// ---------------------------------------------------------------------------
// Field validation (shared by API routes)
// ---------------------------------------------------------------------------

function textOrNull(input: unknown, maxLen: number, label: string): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") {
    throw new ApiError(400, "VALIDATION", `Invalid ${label}.`);
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLen) {
    throw new ApiError(400, "VALIDATION", `${label} must be ${maxLen} characters or fewer.`);
  }
  return trimmed;
}

function httpUrlOrNull(input: unknown, label: string): string | null {
  const value = textOrNull(input, 2000, label);
  if (value === null) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new ApiError(400, "VALIDATION", `${label} must start with http:// or https://.`);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, "VALIDATION", `Please enter a valid ${label.toLowerCase()}.`);
  }
  return value;
}

export function parseSocialLinks(input: unknown): SocialLinks {
  if (input === null || input === undefined) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "VALIDATION", "Invalid social links.");
  }
  const out: SocialLinks = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!(SOCIAL_NETWORKS as readonly string[]).includes(key)) {
      throw new ApiError(400, "VALIDATION", `Unknown social network: ${key}.`);
    }
    const url = httpUrlOrNull(value, "Social link");
    if (url !== null) {
      out[key as (typeof SOCIAL_NETWORKS)[number]] = url;
    }
  }
  return out;
}

export function parseAmenities(input: unknown): string[] {
  if (input === null || input === undefined) return [];
  if (!Array.isArray(input)) {
    throw new ApiError(400, "VALIDATION", "Invalid amenities.");
  }
  if (input.length > 12) {
    throw new ApiError(400, "VALIDATION", "Too many amenities (max 12).");
  }
  const allowed = new Set<string>(STOREFRONT_AMENITIES);
  return input.map((item) => {
    if (typeof item !== "string" || !allowed.has(item)) {
      throw new ApiError(400, "VALIDATION", `Unknown amenity: ${String(item)}.`);
    }
    return item;
  });
}

export function parseSectionOrder(input: unknown): string[] | null {
  if (input === null || input === undefined) return null;
  if (!Array.isArray(input)) {
    throw new ApiError(400, "VALIDATION", "Invalid section order.");
  }
  const allowed = new Set<string>(STOREFRONT_SECTIONS);
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string" || !allowed.has(item) || seen.has(item)) {
      throw new ApiError(400, "VALIDATION", `Unknown section: ${String(item)}.`);
    }
    seen.add(item);
  }
  return [...seen];
}

function parseTemplate(input: unknown): string | undefined {
  if (input === null || input === undefined) return undefined;
  if (typeof input !== "string" || !(STOREFRONT_TEMPLATES as readonly string[]).includes(input)) {
    throw new ApiError(400, "VALIDATION", "That page style isn't available.");
  }
  return input;
}

function parseBoolean(input: unknown, label: string): boolean | undefined {
  if (input === null || input === undefined) return undefined;
  if (typeof input !== "boolean") {
    throw new ApiError(400, "VALIDATION", `Invalid ${label}.`);
  }
  return input;
}

function parseSortOrder(input: unknown): number | undefined {
  if (input === null || input === undefined) return undefined;
  if (typeof input !== "number" || !Number.isInteger(input) || input < 0 || input > 10000) {
    throw new ApiError(400, "VALIDATION", "Invalid ordering.");
  }
  return input;
}

/**
 * Sets the presentation category on the business row. Null clears it
 * (uncategorized renders template defaults). Separate from
 * updateBusinessProfile, which rewrites the whole profile.
 */
export async function setBusinessCategory(
  businessId: string,
  category: string | null,
  db?: DbLike,
): Promise<void> {
  const clean = validateCategory(category);
  const { error } = await serviceDb(db)
    .from("businesses")
    .update({ category: clean, updated_at: new Date().toISOString() })
    .eq("id", businessId);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't save the category. Please try again.");
  }
}

/**
 * Targeted logo/cover writes (validated URLs, null clears). Narrower than
 * updateBusinessProfile, which rewrites the whole profile.
 */
export async function setBusinessMedia(
  businessId: string,
  input: { logoUrl?: unknown; coverUrl?: unknown },
  db?: DbLike,
): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.logoUrl !== undefined) {
    patch.logo_url = httpUrlOrNull(input.logoUrl, "Logo");
  }
  if (input.coverUrl !== undefined) {
    patch.cover_image_url = httpUrlOrNull(input.coverUrl, "Cover image");
  }
  if (Object.keys(patch).length === 1) return;
  const { error } = await serviceDb(db)
    .from("businesses")
    .update(patch)
    .eq("id", businessId);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't save the image. Please try again.");
  }
}

function parseAccent(input: unknown, label: string): string | undefined {
  if (input === null || input === undefined) return undefined;
  if (typeof input !== "string" || !/^#[0-9a-f]{6}$/i.test(input.trim())) {
    throw new ApiError(400, "VALIDATION", `Please pick a valid ${label} colour.`);
  }
  const hex = input.trim();
  if (!isReadableAccent(hex)) {
    throw new ApiError(
      400,
      "VALIDATION",
      `That ${label} colour is too light — text would be hard to read.`,
    );
  }
  return hex;
}

/**
 * Merges primary/accent into the existing theme_config (other keys
 * preserved). Both colours must keep white text readable.
 */
export async function setBusinessTheme(
  businessId: string,
  input: { primary?: unknown; accent?: unknown },
  db?: DbLike,
): Promise<void> {
  const primary = parseAccent(input.primary, "primary");
  const accent = parseAccent(input.accent, "accent");
  if (primary === undefined && accent === undefined) return;
  const client = serviceDb(db);
  const { data, error: readError } = await client
    .from("businesses")
    .select("theme_config")
    .eq("id", businessId)
    .maybeSingle();
  if (readError || !data) {
    throw new ApiError(404, "BOOKING_NOT_FOUND", "Business not found.");
  }
  const current =
    (data as Record<string, unknown>).theme_config &&
    typeof (data as Record<string, unknown>).theme_config === "object"
      ? ((data as Record<string, unknown>).theme_config as Record<string, unknown>)
      : {};
  const { error } = await client
    .from("businesses")
    .update({
      theme_config: {
        ...current,
        ...(primary !== undefined ? { primary } : {}),
        ...(accent !== undefined ? { accent } : {}),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't save the colours. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Reads (all tolerate missing rows)
// ---------------------------------------------------------------------------

function mapStorefront(row: Record<string, unknown>): StorefrontRow {
  return {
    business_id: String(row.business_id),
    template: typeof row.template === "string" ? row.template : "appointment_modern",
    headline: typeof row.headline === "string" ? row.headline : null,
    subheadline: typeof row.subheadline === "string" ? row.subheadline : null,
    hero_image_url: typeof row.hero_image_url === "string" ? row.hero_image_url : null,
    show_gallery: row.show_gallery !== false,
    show_team: row.show_team !== false,
    show_reviews: row.show_reviews !== false,
    show_about: row.show_about !== false,
    show_hours: row.show_hours !== false,
    show_location: row.show_location !== false,
    show_social: row.show_social !== false,
    social_links:
      row.social_links && typeof row.social_links === "object" && !Array.isArray(row.social_links)
        ? (row.social_links as SocialLinks)
        : {},
    amenities: Array.isArray(row.amenities)
      ? (row.amenities as unknown[]).filter((a): a is string => typeof a === "string")
      : [],
    section_order: Array.isArray(row.section_order)
      ? (row.section_order as unknown[]).filter((s): s is string => typeof s === "string")
      : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Storefront config for one business, or null (render defaults). */
export async function getStorefront(
  businessId: string,
  db?: DbLike,
): Promise<StorefrontRow | null> {
  const { data, error } = await serviceDb(db)
    .from("business_storefronts")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error || !data) return null;
  return mapStorefront(data as Record<string, unknown>);
}

/** Gallery images, display order (featured first, then sort_order). */
export async function listGallery(
  businessId: string,
  db?: DbLike,
): Promise<GalleryRow[]> {
  const { data, error } = await serviceDb(db)
    .from("storefront_gallery")
    .select("id, business_id, image_url, caption, alt_text, sort_order, is_featured, created_at")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .limit(100);
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    business_id: String(row.business_id),
    image_url: String(row.image_url ?? ""),
    caption: typeof row.caption === "string" ? row.caption : null,
    alt_text: typeof row.alt_text === "string" ? row.alt_text : null,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    is_featured: row.is_featured === true,
    created_at: String(row.created_at ?? ""),
  }));
}

/** Visible team profiles in display order (owner views pass all=true). */
export async function listTeam(
  businessId: string,
  db?: DbLike,
  opts?: { all?: boolean },
): Promise<TeamRow[]> {
  let query = serviceDb(db)
    .from("storefront_team")
    .select(
      "id, business_id, member_user_id, name, role, bio, photo_url, visible, bookable, sort_order, created_at",
    )
    .eq("business_id", businessId);
  if (!opts?.all) query = query.eq("visible", true);
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .limit(100);
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    business_id: String(row.business_id),
    member_user_id: typeof row.member_user_id === "string" ? row.member_user_id : null,
    name: String(row.name ?? ""),
    role: typeof row.role === "string" ? row.role : null,
    bio: typeof row.bio === "string" ? row.bio : null,
    photo_url: typeof row.photo_url === "string" ? row.photo_url : null,
    visible: row.visible !== false,
    bookable: row.bookable === true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    created_at: String(row.created_at ?? ""),
  }));
}

/** Visible legitimate reviews, newest first (owner views pass all=true). */
export async function listReviews(
  businessId: string,
  db?: DbLike,
  opts?: { all?: boolean },
): Promise<ReviewRow[]> {
  let query = serviceDb(db)
    .from("storefront_reviews")
    .select(
      "id, business_id, source, external_id, reviewer_name, rating, body, review_date, visible, created_at",
    )
    .eq("business_id", businessId);
  if (!opts?.all) query = query.eq("visible", true);
  const { data, error } = await query
    .order("review_date", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    business_id: String(row.business_id),
    source: typeof row.source === "string" ? row.source : "manual",
    external_id: typeof row.external_id === "string" ? row.external_id : null,
    reviewer_name: typeof row.reviewer_name === "string" ? row.reviewer_name : null,
    rating: typeof row.rating === "number" ? row.rating : null,
    body: typeof row.body === "string" ? row.body : null,
    review_date: typeof row.review_date === "string" ? row.review_date : null,
    visible: row.visible !== false,
    created_at: String(row.created_at ?? ""),
  }));
}

/** Everything the public page needs in parallel (all parts optional). */
export async function getStorefrontBundle(
  businessId: string,
  db?: DbLike,
): Promise<StorefrontBundle> {
  const [storefront, gallery, team, reviews] = await Promise.all([
    getStorefront(businessId, db),
    listGallery(businessId, db),
    listTeam(businessId, db),
    listReviews(businessId, db),
  ]);
  return { storefront, gallery, team, reviews };
}

// ---------------------------------------------------------------------------
// Writes (routes enforce owner membership first)
// ---------------------------------------------------------------------------

export interface StorefrontPatch {
  template?: unknown;
  headline?: unknown;
  subheadline?: unknown;
  heroImageUrl?: unknown;
  showGallery?: unknown;
  showTeam?: unknown;
  showReviews?: unknown;
  showAbout?: unknown;
  showHours?: unknown;
  showLocation?: unknown;
  showSocial?: unknown;
  socialLinks?: unknown;
  amenities?: unknown;
  sectionOrder?: unknown;
}

/** Creates or patches the 1:1 storefront config (upsert = idempotent). */
export async function upsertStorefront(
  businessId: string,
  patch: StorefrontPatch,
  db?: DbLike,
): Promise<StorefrontRow> {
  const row: Record<string, unknown> = {
    business_id: businessId,
    updated_at: new Date().toISOString(),
  };
  const template = parseTemplate(patch.template);
  if (template !== undefined) row.template = template;
  const headline = textOrNull(patch.headline, 120, "Headline");
  if (patch.headline !== undefined) row.headline = headline;
  const subheadline = textOrNull(patch.subheadline, 200, "Subheadline");
  if (patch.subheadline !== undefined) row.subheadline = subheadline;
  const hero = httpUrlOrNull(patch.heroImageUrl, "Hero image");
  if (patch.heroImageUrl !== undefined) row.hero_image_url = hero;
  for (const [key, column] of [
    ["showGallery", "show_gallery"],
    ["showTeam", "show_team"],
    ["showReviews", "show_reviews"],
    ["showAbout", "show_about"],
    ["showHours", "show_hours"],
    ["showLocation", "show_location"],
    ["showSocial", "show_social"],
  ] as const) {
    const value = parseBoolean(patch[key], key);
    if (value !== undefined) row[column] = value;
  }
  if (patch.socialLinks !== undefined) row.social_links = parseSocialLinks(patch.socialLinks);
  if (patch.amenities !== undefined) row.amenities = parseAmenities(patch.amenities);
  if (patch.sectionOrder !== undefined) row.section_order = parseSectionOrder(patch.sectionOrder);

  const { data, error } = await serviceDb(db)
    .from("business_storefronts")
    .upsert(row, { onConflict: "business_id" })
    .select("*")
    .maybeSingle();
  if (error || !data) {
    throw new ApiError(500, "INTERNAL", "We couldn't save the storefront. Please try again.");
  }
  return mapStorefront(data as Record<string, unknown>);
}

export interface GalleryInput {
  imageUrl: unknown;
  caption?: unknown;
  altText?: unknown;
  sortOrder?: unknown;
  isFeatured?: unknown;
}

/** Adds one gallery image (URL already validated/uploaded by the caller). */
export async function addGalleryImage(
  businessId: string,
  input: GalleryInput,
  db?: DbLike,
): Promise<GalleryRow> {
  const imageUrl = httpUrlOrNull(input.imageUrl, "Image");
  if (!imageUrl) {
    throw new ApiError(400, "VALIDATION", "A gallery image needs a valid image URL.");
  }
  const { data, error } = await serviceDb(db)
    .from("storefront_gallery")
    .insert({
      business_id: businessId,
      image_url: imageUrl,
      caption: textOrNull(input.caption, 140, "Caption"),
      alt_text: textOrNull(input.altText, 140, "Alt text"),
      sort_order: parseSortOrder(input.sortOrder) ?? 0,
      is_featured: parseBoolean(input.isFeatured, "isFeatured") ?? false,
    })
    .select("id, business_id, image_url, caption, alt_text, sort_order, is_featured, created_at")
    .single();
  if (error || !data) {
    throw new ApiError(500, "INTERNAL", "We couldn't add the image. Please try again.");
  }
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    image_url: String(row.image_url ?? ""),
    caption: typeof row.caption === "string" ? row.caption : null,
    alt_text: typeof row.alt_text === "string" ? row.alt_text : null,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    is_featured: row.is_featured === true,
    created_at: String(row.created_at ?? ""),
  };
}

/** Patches caption/alt/order/featured on one gallery image (same tenant). */
export async function updateGalleryImage(
  businessId: string,
  imageId: string,
  input: Omit<GalleryInput, "imageUrl">,
  db?: DbLike,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.caption !== undefined) patch.caption = textOrNull(input.caption, 140, "Caption");
  if (input.altText !== undefined) patch.alt_text = textOrNull(input.altText, 140, "Alt text");
  const sortOrder = parseSortOrder(input.sortOrder);
  if (sortOrder !== undefined) patch.sort_order = sortOrder;
  const featured = parseBoolean(input.isFeatured, "isFeatured");
  if (featured !== undefined) patch.is_featured = featured;
  if (Object.keys(patch).length === 0) return;
  const { error } = await serviceDb(db)
    .from("storefront_gallery")
    .update(patch)
    .eq("id", imageId)
    .eq("business_id", businessId);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't update the image. Please try again.");
  }
}

/** Removes one gallery image (same tenant). Storage cleanup is separate. */
export async function deleteGalleryImage(
  businessId: string,
  imageId: string,
  db?: DbLike,
): Promise<void> {
  const { error } = await serviceDb(db)
    .from("storefront_gallery")
    .delete()
    .eq("id", imageId)
    .eq("business_id", businessId);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't remove the image. Please try again.");
  }
}

export interface TeamInput {
  name: unknown;
  role?: unknown;
  bio?: unknown;
  photoUrl?: unknown;
  visible?: unknown;
  bookable?: unknown;
  sortOrder?: unknown;
}

/** Adds one public team profile (never implies a login). */
export async function createTeamMember(
  businessId: string,
  input: TeamInput,
  db?: DbLike,
): Promise<TeamRow> {
  const name = textOrNull(input.name, 80, "Name");
  if (!name) {
    throw new ApiError(400, "VALIDATION", "Please give the team member a name.");
  }
  const { data, error } = await serviceDb(db)
    .from("storefront_team")
    .insert({
      business_id: businessId,
      name,
      role: textOrNull(input.role, 80, "Role"),
      bio: textOrNull(input.bio, 500, "Bio"),
      photo_url: httpUrlOrNull(input.photoUrl, "Photo"),
      visible: parseBoolean(input.visible, "visible") ?? true,
      bookable: parseBoolean(input.bookable, "bookable") ?? false,
      sort_order: parseSortOrder(input.sortOrder) ?? 0,
    })
    .select(
      "id, business_id, member_user_id, name, role, bio, photo_url, visible, bookable, sort_order, created_at",
    )
    .single();
  if (error || !data) {
    throw new ApiError(500, "INTERNAL", "We couldn't add the team member. Please try again.");
  }
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    member_user_id: typeof row.member_user_id === "string" ? row.member_user_id : null,
    name: String(row.name ?? ""),
    role: typeof row.role === "string" ? row.role : null,
    bio: typeof row.bio === "string" ? row.bio : null,
    photo_url: typeof row.photo_url === "string" ? row.photo_url : null,
    visible: row.visible !== false,
    bookable: row.bookable === true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    created_at: String(row.created_at ?? ""),
  };
}

/** Patches one team profile (same tenant). */
export async function updateTeamMember(
  businessId: string,
  memberId: string,
  input: Partial<TeamInput>,
  db?: DbLike,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = textOrNull(input.name, 80, "Name");
    if (!name) throw new ApiError(400, "VALIDATION", "Please give the team member a name.");
    patch.name = name;
  }
  if (input.role !== undefined) patch.role = textOrNull(input.role, 80, "Role");
  if (input.bio !== undefined) patch.bio = textOrNull(input.bio, 500, "Bio");
  if (input.photoUrl !== undefined) patch.photo_url = httpUrlOrNull(input.photoUrl, "Photo");
  const visible = parseBoolean(input.visible, "visible");
  if (visible !== undefined) patch.visible = visible;
  const bookable = parseBoolean(input.bookable, "bookable");
  if (bookable !== undefined) patch.bookable = bookable;
  const sortOrder = parseSortOrder(input.sortOrder);
  if (sortOrder !== undefined) patch.sort_order = sortOrder;
  if (Object.keys(patch).length === 0) return;
  const { error } = await serviceDb(db)
    .from("storefront_team")
    .update(patch)
    .eq("id", memberId)
    .eq("business_id", businessId);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't update the team member. Please try again.");
  }
}

/** Removes one team profile (same tenant). Never touches auth/memberships. */
export async function deleteTeamMember(
  businessId: string,
  memberId: string,
  db?: DbLike,
): Promise<void> {
  const { error } = await serviceDb(db)
    .from("storefront_team")
    .delete()
    .eq("id", memberId)
    .eq("business_id", businessId);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't remove the team member. Please try again.");
  }
}

/**
 * Removes one imported review (owner moderation, same tenant).
 * V1 has no manual review-entry feature by design — this only deletes.
 */
export async function deleteReview(
  businessId: string,
  reviewId: string,
  db?: DbLike,
): Promise<void> {
  const { error } = await serviceDb(db)
    .from("storefront_reviews")
    .delete()
    .eq("id", reviewId)
    .eq("business_id", businessId);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't remove the review. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Storefront media uploads (Supabase Storage, service-role via API layer)
// ---------------------------------------------------------------------------

export const STOREFRONT_MEDIA_BUCKET = "storefront-media";

/** Upload slots. The path segment is allowlisted — never client-built. */
export const MEDIA_KINDS = ["logo", "cover", "gallery", "team", "service"] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** 5 MB per image — plenty for web heroes, small enough to stay cheap. */
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MediaUploadInput {
  kind: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  bytes: Uint8Array | Buffer;
}

export interface MediaUploadResult {
  url: string;
  /** Storage path, needed for later deletion. */
  path: string;
}

/**
 * Validates and stores one storefront image at
 * `{businessId}/{kind}/{uuid}.{ext}`. Paths are built server-side from
 * validated parts only — client input can never escape the tenant prefix.
 */
export async function uploadStorefrontMedia(
  businessId: string,
  input: MediaUploadInput,
  db?: SupabaseClient,
): Promise<MediaUploadResult> {
  if (!UUID_RE.test(businessId)) {
    throw new ApiError(400, "VALIDATION", "Invalid business.");
  }
  if (!(MEDIA_KINDS as readonly string[]).includes(input.kind)) {
    throw new ApiError(400, "VALIDATION", "Invalid upload slot.");
  }
  const ext = MEDIA_EXTENSIONS[input.contentType];
  if (!ext) {
    throw new ApiError(
      400,
      "VALIDATION",
      "Please upload a JPG, PNG, or WebP image.",
    );
  }
  if (
    typeof input.sizeBytes !== "number" ||
    !Number.isFinite(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_MEDIA_BYTES
  ) {
    throw new ApiError(400, "VALIDATION", "Images must be 5 MB or smaller.");
  }
  if (!input.bytes || input.bytes.length === 0) {
    throw new ApiError(400, "VALIDATION", "The uploaded file is empty.");
  }

  const path = `${businessId}/${input.kind}/${randomUUID()}.${ext}`;
  const client = (db ?? getSupabase()) as SupabaseClient;
  const { error } = await client.storage
    .from(STOREFRONT_MEDIA_BUCKET)
    .upload(path, input.bytes as Buffer, {
      contentType: input.contentType,
      upsert: false,
    });
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't store the image. Please try again.");
  }
  const { data } = client.storage.from(STOREFRONT_MEDIA_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/**
 * Deletes one storefront object. The path MUST live under the business
 * prefix — anything else is rejected before touching Storage.
 */
export async function deleteStorefrontMedia(
  businessId: string,
  path: string,
  db?: SupabaseClient,
): Promise<void> {
  if (!UUID_RE.test(businessId)) {
    throw new ApiError(400, "VALIDATION", "Invalid business.");
  }
  if (typeof path !== "string" || !path.startsWith(`${businessId}/`)) {
    throw new ApiError(400, "VALIDATION", "That image doesn't belong to this business.");
  }
  if (path.includes("..")) {
    throw new ApiError(400, "VALIDATION", "Invalid image path.");
  }
  const client = (db ?? getSupabase()) as SupabaseClient;
  const { error } = await client.storage.from(STOREFRONT_MEDIA_BUCKET).remove([path]);
  if (error) {
    throw new ApiError(500, "INTERNAL", "We couldn't remove the image. Please try again.");
  }
}

/**
 * Extracts the storage path from a storefront-media public URL so rows
 * can clean up their object on delete. Returns null for external
 * (hotlinked) URLs, which are never touched.
 */
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string" || url.length === 0) return null;
  const marker = `/storage/v1/object/public/${STOREFRONT_MEDIA_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split("?")[0];
  if (!path || path.includes("..")) return null;
  return path;
}
