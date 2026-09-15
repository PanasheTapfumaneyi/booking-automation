import type { BusinessRow } from "@/lib/server/database";
import type { ServiceSummary } from "@/lib/server/businesses";
import type { BusinessHours } from "@/lib/availability/hours";
import type { StorefrontBundle } from "@/lib/server/storefront";
import { STOREFRONT_CATEGORY_LABELS } from "@/lib/storefront-config";
import {
  aggregateRating,
  getTodayIndex,
  getTodayStatus,
  resolveSectionOrder,
  resolveSocialEntries,
  resolveVisibleSections,
} from "@/lib/storefront-public";
import StorefrontHeader from "./StorefrontHeader";
import StorefrontHero from "./StorefrontHero";
import TrustStrip from "./TrustStrip";
import ServiceMenu from "./ServiceMenu";
import StorefrontGallery from "./StorefrontGallery";
import StorefrontTeam from "./StorefrontTeam";
import StorefrontReviews, { type PublicReview } from "./StorefrontReviews";
import StorefrontAbout from "./StorefrontAbout";
import StorefrontHours from "./StorefrontHours";
import StorefrontLocation from "./StorefrontLocation";
import StorefrontSocial from "./StorefrontSocial";
import StorefrontFooter from "./StorefrontFooter";
import StorefrontStickyCta from "./StorefrontStickyCta";

export interface AppointmentStorefrontData {
  business: BusinessRow;
  services: ServiceSummary[];
  hours: BusinessHours | null;
  accent: string;
  bookHref: string;
  preview: boolean;
  demoReviews: Array<{ name: string; text: string; rating: number }>;
  bundle: StorefrontBundle;
}

function formatReviewDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const time = Date.parse(isoDate);
  if (!Number.isFinite(time)) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(time));
  } catch {
    return null;
  }
}

/**
 * Storefront 2.0 appointment template. Renders for EVERY active
 * appointment business from existing businesses/services data; the
 * optional storefront row only customizes. Empty sections vanish —
 * a minimally configured business still looks intentional.
 */
export default function AppointmentStorefront({ data }: { data: AppointmentStorefrontData }) {
  const { business, services, hours, accent, bookHref, preview, bundle } = data;
  const storefront = bundle.storefront;
  const timezone = business.timezone;

  const heroImageUrl = storefront?.hero_image_url ?? business.cover_image_url ?? null;
  const headline = storefront?.headline?.trim() || null;
  const subheadline = storefront?.subheadline?.trim() || business.tagline?.trim() || null;
  const eyebrow =
    (business.category && STOREFRONT_CATEGORY_LABELS[business.category]) || null;

  const status = getTodayStatus(hours, timezone);
  const locationLine = business.address?.trim() || null;
  const directionsHref = business.latitude !== null && business.longitude !== null
    ? `https://www.openstreetmap.org/?mlat=${business.latitude}&mlon=${business.longitude}#map=15/${business.latitude}/${business.longitude}`
    : business.address
      ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(business.address)}`
      : null;
  const contactHref = business.phone ? `tel:${business.phone.replace(/[^+\d]/g, "")}` : null;

  // Legitimate reviews first; demo tenants keep their showcase reviews.
  const dbReviews: PublicReview[] = bundle.reviews.map((review) => ({
    reviewerName: review.reviewer_name,
    rating: review.rating,
    body: review.body,
    dateLabel: formatReviewDate(review.review_date),
    source: review.source,
  }));
  const demoReviews: PublicReview[] = data.demoReviews.map((review) => ({
    reviewerName: review.name,
    rating: review.rating,
    body: review.text,
    dateLabel: null,
    source: null,
  }));
  const reviews = business.is_demo ? demoReviews : dbReviews;
  const aggregate = aggregateRating(reviews);

  const visible = resolveVisibleSections({
    flags: storefront
      ? {
          showGallery: storefront.show_gallery,
          showTeam: storefront.show_team,
          showReviews: storefront.show_reviews,
          showAbout: storefront.show_about,
          showHours: storefront.show_hours,
          showLocation: storefront.show_location,
          showSocial: storefront.show_social,
        }
      : null,
    hasServices: services.length > 0,
    galleryCount: bundle.gallery.length,
    visibleTeamCount: bundle.team.filter((member) => member.visible).length,
    reviewCount: reviews.length,
    hasAbout: Boolean(business.description?.trim()),
    hasHours: hours !== null,
    hasLocation: Boolean(business.address?.trim()) || business.latitude !== null,
    socialCount: resolveSocialEntries(
      (storefront?.social_links ?? null) as Record<string, unknown> | null,
    ).length,
  });

  const socialEntries = resolveSocialEntries(
    (storefront?.social_links ?? null) as Record<string, unknown> | null,
  );

  const anchors: Array<{ id: string; label: string }> = [];
  if (visible.services) anchors.push({ id: "services", label: "Services" });
  if (visible.gallery) anchors.push({ id: "gallery", label: "Gallery" });
  if (visible.team) anchors.push({ id: "team", label: "Team" });
  if (visible.reviews) anchors.push({ id: "reviews", label: "Reviews" });
  if (visible.location) anchors.push({ id: "location", label: "Visit us" });

  const order = resolveSectionOrder(storefront?.section_order ?? null);
  const todayIndex = getTodayIndex(timezone);

  const sections: Record<string, React.ReactNode> = {
    services: visible.services ? (
      <ServiceMenu
        key="services"
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          durationMinutes: service.duration_minutes,
          price: service.price,
        }))}
        bookHref={bookHref}
        accent={accent}
      />
    ) : null,
    gallery: visible.gallery ? (
      <StorefrontGallery
        key="gallery"
        businessName={business.name}
        images={bundle.gallery.map((image, index) => ({
          src: image.image_url,
          alt: image.alt_text || image.caption || `${business.name} photo ${index + 1}`,
        }))}
      />
    ) : null,
    team: visible.team ? (
      <StorefrontTeam
        key="team"
        members={bundle.team
          .filter((member) => member.visible)
          .map((member) => ({
            name: member.name,
            role: member.role,
            bio: member.bio,
            photoUrl: member.photo_url,
          }))}
      />
    ) : null,
    reviews: visible.reviews ? (
      <StorefrontReviews key="reviews" reviews={reviews} aggregate={aggregate} />
    ) : null,
    about: visible.about && business.description ? (
      <StorefrontAbout
        key="about"
        businessName={business.name}
        description={business.description}
      />
    ) : null,
    hours: visible.hours && hours ? (
      <StorefrontHours key="hours" hours={hours} status={status} todayIndex={todayIndex} />
    ) : null,
    location: visible.location ? (
      <StorefrontLocation
        key="location"
        address={business.address}
        latitude={business.latitude}
        longitude={business.longitude}
        businessName={business.name}
        phone={business.phone}
        email={business.email}
        accent={accent}
      />
    ) : null,
    contact: null,
    hero: null,
  };

  const amenities = storefront?.amenities ?? [];

  return (
    <div id="top" className="min-h-screen bg-paper pb-24 text-ink sm:pb-0">
      {preview && (
        <div role="status" className="border-b border-blue/30 bg-blue-mist">
          <p className="mx-auto max-w-6xl px-5 py-3 text-center text-sm">
            <span className="font-semibold text-blue-ink">Preview — this page isn&apos;t public yet.</span>{" "}
            <span className="text-ink-soft">
              Test bookings freely; Kivo activates the page once your setup is finalized.
            </span>
          </p>
        </div>
      )}
      <StorefrontHeader
        name={business.name}
        logoUrl={business.logo_url}
        bookHref={bookHref}
        accent={accent}
        anchors={anchors}
      />
      <main>
        <StorefrontHero
          name={business.name}
          eyebrow={eyebrow}
          headline={headline}
          subheadline={subheadline}
          heroImageUrl={heroImageUrl}
          heroImageAlt={`${business.name} — storefront photo`}
          status={status}
          locationLine={locationLine}
          bookHref={bookHref}
          directionsHref={directionsHref}
          contactHref={contactHref}
          accent={accent}
        />
        <TrustStrip
          rating={aggregate}
          location={locationLine}
          accent={accent}
        />
        {order.map((key) => sections[key] ?? null)}
        {amenities.length > 0 && (
          <div className="mx-auto w-full max-w-4xl px-5 pb-14 sm:pb-20">
            <ul aria-label="Amenities" className="flex flex-wrap gap-2">
              {amenities.map((amenity) => (
                <li
                  key={amenity}
                  className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm text-ink-soft"
                >
                  {amenity}
                </li>
              ))}
            </ul>
          </div>
        )}
        {visible.social && (
          <StorefrontSocial businessName={business.name} entries={socialEntries} />
        )}
      </main>
      <StorefrontFooter businessName={business.name} bookHref={bookHref} />
      <StorefrontStickyCta bookHref={bookHref} accent={accent} />
    </div>
  );
}
