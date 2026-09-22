/**
 * Business duplication (admin cold-call cloning).
 *
 * Copies a source business into a brand-new tenant: fresh id/slug, blanked
 * contact details, remapped offering + storefront rows, and copied storage
 * objects. Never copies: members (one fresh owner row), customers,
 * bookings, notifications, notification phone, calendar credentials, setup
 * requests, reviews, or analytics.
 *
 * No auth checks here — the route enforces platform-admin first. Uses the
 * service-role client passed in (server-only).
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/server/errors";
import {
  slugify,
  ensureUniqueSlug,
  validateSlug,
  validateBusinessProfile,
  listServices,
  listResources,
  listSessions,
} from "@/lib/server/businesses";
import {
  getStorefrontBundle,
  STOREFRONT_MEDIA_BUCKET,
  MEDIA_KINDS,
  storagePathFromUrl,
} from "@/lib/server/storefront";
import { upsertBusinessNotificationSettings } from "@/lib/server/notifications/records";

type DbLike = Pick<SupabaseClient, "from" | "rpc" | "storage">;

export interface DuplicateBusinessInput {
  /** New business name (2–80 chars, validated like onboarding). */
  name: string;
  /** Optional explicit slug override (validated, 409 on collision). */
  slug?: string | null;
  /** Existing user who will own the clone. */
  ownerUserId: string;
  /** Copy active future sessions (default true). Past sessions never copy. */
  includeFutureSessions?: boolean;
}

export interface DuplicateBusinessCounts {
  services: number;
  resources: number;
  sessions: number;
  gallery: number;
  team: number;
}

export interface DuplicateBusinessResult {
  id: string;
  slug: string;
  counts: DuplicateBusinessCounts;
}

const EXT_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Copies one storage object into the new tenant prefix.
 * Returns the new public URL. External URLs are never passed here —
 * callers filter with storagePathFromUrl first.
 */
async function copyStorageObject(
  client: SupabaseClient,
  sourcePath: string,
  newBusinessId: string,
): Promise<{ url: string; path: string }> {
  const { data: blob, error: downloadError } = await client.storage
    .from(STOREFRONT_MEDIA_BUCKET)
    .download(sourcePath);
  if (downloadError || !blob) {
    throw new ApiError(500, "INTERNAL", "We couldn't copy an image. Please try again.");
  }
  const segments = sourcePath.split("/");
  const kindSegment = segments.length >= 3 ? segments[1] : "";
  const kind = (MEDIA_KINDS as readonly string[]).includes(kindSegment) ? kindSegment : "gallery";
  const ext = (sourcePath.split(".").pop() ?? "jpg").toLowerCase();
  const contentType = EXT_CONTENT_TYPES[ext] ?? "image/jpeg";
  const newPath = `${newBusinessId}/${kind}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await client.storage
    .from(STOREFRONT_MEDIA_BUCKET)
    .upload(newPath, blob, { contentType, upsert: false });
  if (uploadError) {
    throw new ApiError(500, "INTERNAL", "We couldn't copy an image. Please try again.");
  }
  const { data } = client.storage.from(STOREFRONT_MEDIA_BUCKET).getPublicUrl(newPath);
  return { url: data.publicUrl, path: newPath };
}

export async function duplicateBusiness(
  sourceBusinessId: string,
  input: DuplicateBusinessInput,
  db: DbLike,
): Promise<DuplicateBusinessResult> {
  const profile = validateBusinessProfile({ name: input.name });
  if (typeof input.ownerUserId !== "string" || input.ownerUserId.trim().length === 0) {
    throw new ApiError(400, "VALIDATION", "Please specify the user who will own the new business.");
  }
  const ownerUserId = input.ownerUserId.trim();
  const includeFutureSessions = input.includeFutureSessions ?? true;
  const client = db as SupabaseClient;

  // Source row (full profile columns needed for the copy).
  const { data: source, error: sourceError } = await client
    .from("businesses")
    .select(
      "id, timezone, booking_mode, availability, tagline, description, cover_image_url, logo_url, theme_config, category",
    )
    .eq("id", sourceBusinessId)
    .maybeSingle();
  if (sourceError || !source) {
    // Same 404 convention as requireBusinessOwner for a missing business.
    throw new ApiError(404, "BOOKING_NOT_FOUND", "That business wasn't found.");
  }
  const src = source as Record<string, unknown>;

  const exists = async (slug: string): Promise<boolean> => {
    const { data } = await client.from("businesses").select("id").eq("slug", slug).maybeSingle();
    return Boolean(data);
  };
  let slug: string;
  const override = typeof input.slug === "string" ? input.slug.trim() : "";
  if (override) {
    slug = validateSlug(override);
    if (await exists(slug)) {
      throw new ApiError(409, "CONFLICT", "That booking link is already taken. Please choose another.");
    }
  } else {
    slug = await ensureUniqueSlug(slugify(profile.name), exists);
  }

  // Offering + storefront reads (fail before writing anything).
  const [services, resources, sessions, bundle] = await Promise.all([
    listServices(sourceBusinessId, db),
    listResources(sourceBusinessId, db),
    includeFutureSessions
      ? listSessions(sourceBusinessId, db).catch(() => [])
      : Promise.resolve([]),
    getStorefrontBundle(sourceBusinessId, db).catch(() => ({
      storefront: null,
      gallery: [],
      team: [],
      reviews: [],
    })),
  ]);
  const futureSessions = sessions.filter(
    (s) => s.active && Date.parse(s.start_time) > Date.now(),
  );

  // New tenant row. Contact/location blanked so enquiries can never leak
  // to the source business; calendar link must be re-authorized.
  const { data: created, error: createError } = await client
    .from("businesses")
    .insert({
      name: profile.name,
      phone: null,
      email: null,
      timezone: (src.timezone as string) ?? "Indian/Mauritius",
      booking_mode: src.booking_mode,
      slug,
      address: null,
      description: (src.description as string | null) ?? null,
      is_demo: false,
      is_active: true,
      availability: (src.availability as Record<string, unknown> | null) ?? null,
      tagline: (src.tagline as string | null) ?? null,
      cover_image_url: (src.cover_image_url as string | null) ?? null,
      logo_url: (src.logo_url as string | null) ?? null,
      theme_config: (src.theme_config as Record<string, unknown> | null) ?? null,
      category: (src.category as string | null) ?? null,
      latitude: null,
      longitude: null,
    })
    .select("id, slug")
    .single();
  if (createError || !created) {
    throw new ApiError(500, "INTERNAL", "We couldn't duplicate that business. Please try again.");
  }
  const newId = (created as { id: string }).id;
  const copiedPaths: string[] = [];

  async function cleanup(): Promise<void> {
    try {
      await client.from("businesses").delete().eq("id", newId);
    } catch {
      // Best effort — the row may already be gone.
    }
    if (copiedPaths.length > 0) {
      try {
        await client.storage.from(STOREFRONT_MEDIA_BUCKET).remove(copiedPaths);
      } catch {
        // Best effort — orphaned objects are inert without DB rows.
      }
    }
  }

  try {
    const { error: memberError } = await client.from("business_members").insert({
      business_id: newId,
      user_id: ownerUserId,
      role: "owner",
    });
    if (memberError) throw memberError;
    await upsertBusinessNotificationSettings(newId, {}, db);

    // Services (ids remapped for session rewiring below).
    const serviceIdMap = new Map<string, string>();
    for (const svc of services) {
      const { data: row, error } = await client
        .from("services")
        .insert({
          business_id: newId,
          name: svc.name,
          duration_minutes: svc.duration_minutes,
          price: svc.price,
          active: svc.active,
          description: svc.description,
          image_url: svc.image_url,
        })
        .select("id")
        .single();
      if (error || !row) throw error ?? new Error("service insert failed");
      serviceIdMap.set(svc.id, (row as { id: string }).id);
    }

    // Resources.
    for (const res of resources) {
      const { error } = await client.from("resources").insert({
        business_id: newId,
        name: res.name,
        description: res.description,
        resource_type: res.resource_type,
        active: res.active,
        image_url: res.image_url,
        metadata: res.metadata,
      });
      if (error) throw error;
    }

    // Future sessions only, rewired to the new service ids. Sessions whose
    // service didn't copy (shouldn't happen) are skipped, never orphaned.
    let sessionCount = 0;
    for (const sess of futureSessions) {
      const newServiceId = serviceIdMap.get(sess.service_id);
      if (!newServiceId) continue;
      const { error } = await client.from("booking_sessions").insert({
        business_id: newId,
        service_id: newServiceId,
        start_time: sess.start_time,
        end_time: sess.end_time,
        capacity: sess.capacity,
        active: sess.active,
      });
      if (error) throw error;
      sessionCount += 1;
    }

    // Storefront config (reviews deliberately skipped).
    if (bundle.storefront) {
      const sf = bundle.storefront;
      const { error } = await client.from("business_storefronts").insert({
        business_id: newId,
        template: sf.template,
        headline: sf.headline,
        subheadline: sf.subheadline,
        hero_image_url: sf.hero_image_url,
        show_gallery: sf.show_gallery,
        show_team: sf.show_team,
        show_reviews: sf.show_reviews,
        show_about: sf.show_about,
        show_hours: sf.show_hours,
        show_location: sf.show_location,
        show_social: sf.show_social,
        social_links: sf.social_links,
        amenities: sf.amenities,
        section_order: sf.section_order,
      });
      if (error) throw error;
    }
    const galleryIds: string[] = [];
    for (const img of bundle.gallery) {
      const { data: row, error } = await client
        .from("storefront_gallery")
        .insert({
          business_id: newId,
          image_url: img.image_url,
          caption: img.caption,
          alt_text: img.alt_text,
          sort_order: img.sort_order,
          is_featured: img.is_featured,
        })
        .select("id")
        .single();
      if (error || !row) throw error ?? new Error("gallery insert failed");
      galleryIds.push((row as { id: string }).id);
    }
    const teamIds: string[] = [];
    for (const member of bundle.team) {
      const { data: row, error } = await client
        .from("storefront_team")
        .insert({
          business_id: newId,
          member_user_id: null,
          name: member.name,
          role: member.role,
          bio: member.bio,
          photo_url: member.photo_url,
          visible: member.visible,
          bookable: member.bookable,
          sort_order: member.sort_order,
        })
        .select("id")
        .single();
      if (error || !row) throw error ?? new Error("team insert failed");
      teamIds.push((row as { id: string }).id);
    }

    // Storage: copy each unique tenant-hosted image, then rewrite URLs.
    // External hotlinks are kept as-is.
    const storageUrls = new Set<string>();
    const collect = (url: unknown) => {
      if (typeof url === "string" && storagePathFromUrl(url)) storageUrls.add(url);
    };
    collect(src.cover_image_url);
    collect(src.logo_url);
    for (const svc of services) collect(svc.image_url);
    for (const res of resources) collect(res.image_url);
    if (bundle.storefront) collect(bundle.storefront.hero_image_url);
    for (const img of bundle.gallery) collect(img.image_url);
    for (const member of bundle.team) collect(member.photo_url);

    const urlMap = new Map<string, string>();
    for (const oldUrl of storageUrls) {
      const sourcePath = storagePathFromUrl(oldUrl);
      if (!sourcePath) continue;
      const { url, path } = await copyStorageObject(client, sourcePath, newId);
      copiedPaths.push(path);
      urlMap.set(oldUrl, url);
    }

    if (urlMap.size > 0) {
      const rewrite = (url: string | null): string | null =>
        url !== null && urlMap.has(url) ? (urlMap.get(url) as string) : url;
      const businessPatch: Record<string, unknown> = {};
      const newCover = rewrite((src.cover_image_url as string | null) ?? null);
      const newLogo = rewrite((src.logo_url as string | null) ?? null);
      if (newCover !== (src.cover_image_url ?? null)) businessPatch.cover_image_url = newCover;
      if (newLogo !== (src.logo_url ?? null)) businessPatch.logo_url = newLogo;
      if (Object.keys(businessPatch).length > 0) {
        const { error } = await client.from("businesses").update(businessPatch).eq("id", newId);
        if (error) throw error;
      }
      for (const svc of services) {
        const next = rewrite(svc.image_url);
        if (next !== svc.image_url) {
          const newServiceId = serviceIdMap.get(svc.id);
          if (newServiceId) {
            const { error } = await client
              .from("services")
              .update({ image_url: next })
              .eq("id", newServiceId);
            if (error) throw error;
          }
        }
      }
      const { data: newResources } = await client
        .from("resources")
        .select("id, image_url")
        .eq("business_id", newId);
      for (const row of (newResources ?? []) as Array<Record<string, unknown>>) {
        const current = (row.image_url as string | null) ?? null;
        const next = rewrite(current);
        if (next !== current) {
          const { error } = await client
            .from("resources")
            .update({ image_url: next })
            .eq("id", row.id as string);
          if (error) throw error;
        }
      }
      if (bundle.storefront?.hero_image_url) {
        const next = rewrite(bundle.storefront.hero_image_url);
        if (next !== bundle.storefront.hero_image_url) {
          const { error } = await client
            .from("business_storefronts")
            .update({ hero_image_url: next })
            .eq("business_id", newId);
          if (error) throw error;
        }
      }
      for (let i = 0; i < bundle.gallery.length; i += 1) {
        const next = rewrite(bundle.gallery[i].image_url);
        if (next !== bundle.gallery[i].image_url && galleryIds[i]) {
          const { error } = await client
            .from("storefront_gallery")
            .update({ image_url: next })
            .eq("id", galleryIds[i]);
          if (error) throw error;
        }
      }
      for (let i = 0; i < bundle.team.length; i += 1) {
        const current = bundle.team[i].photo_url;
        const next = rewrite(current);
        if (next !== current && teamIds[i]) {
          const { error } = await client
            .from("storefront_team")
            .update({ photo_url: next })
            .eq("id", teamIds[i]);
          if (error) throw error;
        }
      }
    }

    return {
      id: newId,
      slug: (created as { slug: string }).slug ?? slug,
      counts: {
        services: services.length,
        resources: resources.length,
        sessions: sessionCount,
        gallery: bundle.gallery.length,
        team: bundle.team.length,
      },
    };
  } catch (err) {
    await cleanup();
    throw err instanceof ApiError
      ? err
      : new ApiError(500, "INTERNAL", "We couldn't duplicate that business. Please try again.");
  }
}
