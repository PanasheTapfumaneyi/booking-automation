"use client";

import Link from "next/link";
import { useState } from "react";
import AmenitiesSection from "./AmenitiesSection";
import AppearanceSection from "./AppearanceSection";
import CompletenessCard, { type CompletenessFacts } from "./CompletenessCard";
import ContentSection from "./ContentSection";
import GallerySection from "./GallerySection";
import SocialSection from "./SocialSection";
import TeamSection from "./TeamSection";
import VisibilitySection from "./VisibilitySection";
import type { EditorInitial, ProgressFacts } from "./types";

/**
 * Storefront editor shell: header (title, status, public link),
 * completeness guidance, and the section editors. Remounted per
 * business (`key={business.id}`) so switching businesses can never
 * leak another tenant's drafts or images.
 */
export default function StorefrontEditor({ initial }: { initial: EditorInitial }) {
  const { business, storefront, gallery, team } = initial;
  const [facts, setFacts] = useState<CompletenessFacts>(() => ({
    logo: Boolean(business.logoUrl),
    cover: Boolean(business.coverUrl),
    headline: Boolean(storefront?.headline?.trim()),
    about: Boolean(business.description?.trim()),
    hours: business.hasHours,
    gallery: gallery.length > 0,
    team: team.some((member) => member.visible),
    social: Object.keys(storefront?.social_links ?? {}).length > 0,
  }));

  function handleProgress(update: ProgressFacts) {
    setFacts((current) => ({
      logo: update.logoUrl !== undefined ? Boolean(update.logoUrl) : current.logo,
      cover: update.coverUrl !== undefined ? Boolean(update.coverUrl) : current.cover,
      headline: update.headline !== undefined ? Boolean(update.headline?.trim()) : current.headline,
      about: current.about,
      hours: current.hours,
      gallery: update.galleryCount !== undefined ? update.galleryCount > 0 : current.gallery,
      team:
        update.visibleTeamCount !== undefined
          ? update.visibleTeamCount > 0
          : current.team,
      social: update.socialCount !== undefined ? update.socialCount > 0 : current.social,
    }));
  }

  const visibilityInitial = {
    showGallery: storefront?.show_gallery ?? true,
    showTeam: storefront?.show_team ?? true,
    showReviews: storefront?.show_reviews ?? true,
    showAbout: storefront?.show_about ?? true,
    showHours: storefront?.show_hours ?? true,
    showLocation: storefront?.show_location ?? true,
    showSocial: storefront?.show_social ?? true,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Storefront</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Customize how customers see {business.name}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              business.isActive ? "bg-blue-soft text-blue-strong" : "bg-surface-muted text-ink-soft",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${business.isActive ? "bg-blue" : "bg-ink-soft/50"}`}
            />
            {business.isActive ? "Live" : "Inactive"}
          </span>
          {business.slug && (
            <Link
              href={`/business/${business.slug}`}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-line bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-blue/50"
            >
              View storefront
            </Link>
          )}
        </div>
      </div>
      {!business.isActive && (
        <p role="status" className="text-sm text-ink-soft">
          This page isn&apos;t public yet — preview it with “View storefront” and keep
          editing. Kivo activates it once your setup is finalized.
        </p>
      )}

      <CompletenessCard facts={facts} />

      <AppearanceSection
        businessId={business.id}
        initialLogo={business.logoUrl}
        initialCover={business.coverUrl}
        initialPrimary={business.themePrimary}
        onProgress={handleProgress}
      />
      <ContentSection
        businessId={business.id}
        businessName={business.name}
        tagline={business.tagline}
        description={business.description}
        initialHeadline={storefront?.headline ?? null}
        initialSubheadline={storefront?.subheadline ?? null}
        initialCategory={business.category}
        onProgress={handleProgress}
      />
      <GallerySection businessId={business.id} initial={gallery} onProgress={handleProgress} />
      <TeamSection businessId={business.id} initial={team} onProgress={handleProgress} />
      <SocialSection
        businessId={business.id}
        initial={storefront?.social_links ?? {}}
        onProgress={handleProgress}
      />
      <AmenitiesSection businessId={business.id} initial={storefront?.amenities ?? []} />
      <VisibilitySection businessId={business.id} initial={visibilityInitial} />
    </div>
  );
}
