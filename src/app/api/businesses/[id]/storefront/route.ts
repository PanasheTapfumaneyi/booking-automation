import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/server";
import { requireBusinessOwner } from "@/lib/server/auth";
import {
  getStorefrontBundle,
  listReviews,
  listTeam,
  setBusinessMedia,
  setBusinessTheme,
  upsertStorefront,
  setBusinessCategory,
  validateCategory,
} from "@/lib/server/storefront";
import { toApiErrorResponse } from "@/lib/server/route-helper";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/businesses/[id]/storefront — owner view of the full
 * storefront bundle (including hidden rows the public page omits).
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const db = getSupabase();
    const bundle = await getStorefrontBundle(ctx.business.id, db);
    // Owner view includes hidden rows; the public page filters them.
    const [teamAll, reviewsAll] = await Promise.all([
      listTeam(ctx.business.id, db, { all: true }),
      listReviews(ctx.business.id, db, { all: true }),
    ]);
    return NextResponse.json({ ...bundle, team: teamAll, reviews: reviewsAll });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/**
 * PATCH /api/businesses/[id]/storefront — partial upsert of the 1:1
 * storefront config, plus optional `category`, logo/cover URLs, and
 * theme colours for the business row. Revalidates the public pages so
 * owners see changes promptly instead of waiting out the cache period.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const ctx = await requireBusinessOwner(id);
    const body = (await request.json().catch(() => null)) as {
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
      category?: unknown;
      logoUrl?: unknown;
      coverUrl?: unknown;
      themePrimary?: unknown;
      themeAccent?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body." }, { status: 400 });
    }
    const db = getSupabase();
    if (body.category !== undefined) {
      await setBusinessCategory(ctx.business.id, validateCategory(body.category), db);
    }
    if (body.logoUrl !== undefined || body.coverUrl !== undefined) {
      await setBusinessMedia(
        ctx.business.id,
        { logoUrl: body.logoUrl, coverUrl: body.coverUrl },
        db,
      );
    }
    if (body.themePrimary !== undefined || body.themeAccent !== undefined) {
      await setBusinessTheme(
        ctx.business.id,
        { primary: body.themePrimary, accent: body.themeAccent },
        db,
      );
    }
    const storefront = await upsertStorefront(
      ctx.business.id,
      {
        template: body.template,
        headline: body.headline,
        subheadline: body.subheadline,
        heroImageUrl: body.heroImageUrl,
        showGallery: body.showGallery,
        showTeam: body.showTeam,
        showReviews: body.showReviews,
        showAbout: body.showAbout,
        showHours: body.showHours,
        showLocation: body.showLocation,
        showSocial: body.showSocial,
        socialLinks: body.socialLinks,
        amenities: body.amenities,
        sectionOrder: body.sectionOrder,
      },
      db,
    );
    revalidatePublicPages(ctx.business.slug);
    return NextResponse.json({ storefront });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

/** Bust the cached public pages after a storefront-affecting write. */
export function revalidatePublicPages(slug: string | null): void {
  if (!slug) return;
  try {
    revalidatePath(`/business/${slug}`);
    revalidatePath(`/book/${slug}`);
  } catch {
    // Cache busting must never break a successful save.
  }
}
