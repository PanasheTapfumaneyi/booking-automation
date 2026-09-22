import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BusinessHero,
  OfferingCard,
  OpeningHours,
  ReviewsSection,
  ContactSection,
  LocationSection,
  BusinessFooter,
} from "@/components/business";
import MobileStickyCta from "@/components/business/MobileStickyCta";
import { getSupabase } from "@/lib/supabase/server";
import { getMyBusinessIds } from "@/lib/server/auth";
import { getBusinessSiteData } from "@/lib/server/public-site";
import { getStorefrontBundle } from "@/lib/server/storefront";
import { parseTheme, themeToCssVars } from "@/lib/server/business-theme";
import AppointmentStorefront from "@/components/storefront-public/AppointmentStorefront";
import StorefrontGallery from "@/components/storefront-public/StorefrontGallery";
import StorefrontTeam from "@/components/storefront-public/StorefrontTeam";
import { resolveVisibleSections } from "@/lib/storefront-public";
import { minutesToLabel } from "@/lib/availability";
import { formatPrice } from "@/lib/demo";
import type { BusinessHours } from "@/lib/availability/hours";
import { SITE_URL } from "@/lib/site-config";
import { JsonLdScript } from "@/lib/seo-jsonld";

interface BusinessPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Public business profile (services, resources, imagery, hours) is
 * relatively stable, so it may be cached for 5 minutes. Dynamic
 * availability is ALWAYS client-fetched per request and is never part
 * of this cache — stale availability or double bookings are impossible
 * from this setting.
 */
export const revalidate = 300;

const MODE_TAGLINE: Record<string, string> = {
  appointment: "Simple booking, without the back-and-forth.",
  resource: "Reserve what you need, when you need it.",
  capacity: "Join a session — spots are limited.",
};

/**
 * A fleet/rental collection: at least one resource carries a per-day price.
 * Unpriced items render a "Contact for price" fallback instead of demoting
 * the whole fleet to priceless listings.
 */
function isUnitRatedFleet(resources: Array<{ metadata: Record<string, unknown> }>): boolean {
  return resources.length > 0 && resources.some((r) => typeof r.metadata?.rate === "number");
}

function getDemoReviews(slug: string): Array<{ name: string; text: string; rating: number }> {
  const reviews: Record<string, Array<{ name: string; text: string; rating: number }>> = {
    "kivo-drive": [
      { name: "Priya N.", text: "Rented the Creta for a road trip to the south. Spotless car, zero paperwork, unreal value.", rating: 5 },
      { name: "Jean-Baptiste D.", text: "Booked online in under a minute. The Hilux handled the coastal track like a dream.", rating: 5 },
      { name: "Fatima A.", text: "Discovered them through the online booking page — no calls, no queues. Just a car waiting for me.", rating: 5 },
    ],
    "fade-area": [
      { name: "Jean-Pierre M.", text: "Best fade in Quatre Bornes. Always leave looking sharp.", rating: 5 },
      { name: "Arjun K.", text: "Quick, clean, and professional. My go-to barbershop.", rating: 5 },
      { name: "David L.", text: "Great atmosphere and attention to detail. Highly recommend.", rating: 4 },
    ],
    "island-surf": [
      { name: "Sarah T.", text: "Perfect boards for beginners and pros. Loved the paddleboard!", rating: 5 },
      { name: "Marco R.", text: "Friendly staff, great gear. Will definitely rent again.", rating: 5 },
      { name: "Emma W.", text: "Easy booking process and fair prices. The longboard was mint.", rating: 4 },
    ],
    "blue-lagoon": [
      { name: "Priya S.", text: "My kids love the swim lessons. Patient, professional instructors.", rating: 5 },
      { name: "Tom H.", text: "Went from terrified to confident in just a few weeks.", rating: 5 },
      { name: "Leila M.", text: "Small class sizes make all the difference. Worth every rupee.", rating: 5 },
    ],
  };
  return reviews[slug] ?? [];
}

export async function generateMetadata({ params }: BusinessPageProps): Promise<Metadata> {
  const { slug } = await params;
  // Owners previewing an inactive business still get metadata (no 404).
  const previewIds = await getMyBusinessIds().catch(() => []);
  const data = await getBusinessSiteData(slug, getSupabase(), {
    previewBusinessIds: previewIds,
  }).catch(() => null);
  // 404 here (not just in the page): generateMetadata resolves before the
  // loading.tsx suspense shell flushes, so the 404 status is committed.
  // A page-only notFound() fires after the shell streams with status 200.
  if (!data) notFound();
  const tagline = data.business.tagline || MODE_TAGLINE[data.business.booking_mode] || "Book online in under a minute.";
  const cleanName = data.business.name.trim().replace(/\.$/, "");
  const canonical = `${SITE_URL}/business/${slug}`;
  // Open Graph identity from existing business imagery (no extra queries).
  const ogImage = data.business.cover_image_url ?? data.business.logo_url ?? null;
  return {
    title: `${data.business.name} — Book online`,
    description: `View services and book online at ${cleanName}. ${tagline}`,
    alternates: { canonical },
    robots: data.business.is_demo === true
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: ogImage ? { images: [{ url: ogImage, alt: data.business.name }] } : undefined,
  };
}

export default async function BusinessPage({ params }: BusinessPageProps) {
  const { slug } = await params;
  const previewIds = await getMyBusinessIds().catch(() => []);
  const data = await getBusinessSiteData(slug, getSupabase(), {
    previewBusinessIds: previewIds,
  }).catch(() => null);
  if (!data) notFound();

  const { business, services, resources, sessions, preview } = data;
  const mode = business.booking_mode;
  const bookHref = `/book/${business.slug ?? slug}`;
  const hours = (business.availability ?? null) as BusinessHours | null;
  const tagline = business.tagline || MODE_TAGLINE[mode] || "Book online in under a minute.";
  const theme = parseTheme(business.theme_config);
  const cssVars = themeToCssVars(theme);

  // Storefront content (gallery, team, DB reviews) loads for EVERY mode.
  // The appointment template and the legacy resource/capacity template
  // both render from this bundle — a business must never lose its
  // configured content because of its booking mode.
  const bundle = await getStorefrontBundle(business.id, getSupabase()).catch(() => ({
    storefront: null,
    gallery: [],
    team: [],
    reviews: [],
  }));

  const galleryImages = bundle.gallery.map((image, index) => ({
    src: image.image_url,
    alt: image.alt_text || image.caption || `${business.name} photo ${index + 1}`,
  }));
  const teamMembers = bundle.team
    .filter((member) => member.visible)
    .map((member) => ({
      name: member.name,
      role: member.role,
      bio: member.bio,
      photoUrl: member.photo_url,
    }));
  // Demo tenants keep their showcase reviews; everyone else reads the
  // owner-managed review rows (visible + with a body).
  const reviews: Array<{ name: string; text: string; rating?: number }> =
    business.is_demo === true
      ? getDemoReviews(slug)
      : bundle.reviews
          .filter((review) => review.visible && review.body?.trim())
          .map((review) => ({
            name: review.reviewer_name?.trim() || "Guest",
            text: (review.body as string).trim(),
            rating: typeof review.rating === "number" ? review.rating : undefined,
          }));

  const storefrontFlags = bundle.storefront
    ? {
        showGallery: bundle.storefront.show_gallery,
        showTeam: bundle.storefront.show_team,
        showReviews: bundle.storefront.show_reviews,
      }
    : null;
  const legacyVisible = resolveVisibleSections({
    flags: storefrontFlags,
    hasServices: services.length > 0,
    galleryCount: galleryImages.length,
    visibleTeamCount: teamMembers.length,
    reviewCount: reviews.length,
    hasAbout: Boolean(business.description?.trim()),
    hasHours: hours !== null,
    hasLocation: Boolean(business.address?.trim()) || business.latitude !== null,
    socialCount: 0,
  });

  // Structured data — only for non-demo businesses
  const localBusinessJsonLd =
    business.is_demo !== true
      ? {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: business.name,
          url: `${SITE_URL}/business/${slug}`,
          telephone: business.phone || undefined,
          address: business.address
            ? { "@type": "PostalAddress", streetAddress: business.address }
            : undefined,
          geo:
            business.latitude != null && business.longitude != null
              ? {
                  "@type": "GeoCoordinates",
                  latitude: Number(business.latitude),
                  longitude: Number(business.longitude),
                }
              : undefined,
          image: business.cover_image_url ?? business.logo_url ?? undefined,
          logo: business.logo_url ?? undefined,
          openingHoursSpecification: hours
            ? Object.entries(hours)
                .filter(([, v]) => v && v.open && v.close)
                .map(([day, v]) => ({
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: day.charAt(0).toUpperCase() + day.slice(1),
                  opens: v!.open,
                  closes: v!.close,
                }))
            : undefined,
        }
      : null;

  // Storefront 2.0: every appointment business renders the new design
  // from existing businesses/services data. The optional storefront row
  // only customizes — it never gates. Resource/capacity keep the
  // existing experience below, byte-for-byte.
  if (business.booking_mode === "appointment") {
    return (
      <>
        {localBusinessJsonLd && <JsonLdScript data={localBusinessJsonLd} />}
        <AppointmentStorefront
          data={{
            business,
            services,
            hours,
            accent: theme.primary,
            bookHref,
            preview,
            demoReviews: getDemoReviews(slug),
            bundle,
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink pb-16 sm:pb-0" style={cssVars}>
      {localBusinessJsonLd && <JsonLdScript data={localBusinessJsonLd} />}
      <main className="flex-1">
        {preview && (
          <div role="status" className="border-b border-blue/30 bg-blue-mist">
            <p className="mx-auto max-w-[1200px] px-6 py-3 text-center text-sm">
              <span className="font-semibold text-blue-ink">Preview — this page isn&apos;t public yet.</span>{" "}
              <span className="text-ink-soft">
                Test bookings freely; Kivo activates the page once your setup is finalized.
              </span>
            </p>
          </div>
        )}
        <BusinessHero
          name={business.name}
          tagline={tagline}
          mode={mode}
          coverImageUrl={business.cover_image_url ?? null}
          logoUrl={business.logo_url ?? null}
          bookHref={bookHref}
          phone={business.phone ?? null}
          theme={theme}
        />

        {business.description && (
          <section className="mx-auto max-w-[1200px] px-6 py-14 sm:py-16">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink">About</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft whitespace-pre-line">
              {business.description}
            </p>
          </section>
        )}

        <section className="mx-auto max-w-[1200px] px-6 py-14 sm:py-20">
          <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink">
            {mode === "appointment" && "Services"}
            {mode === "resource" && (isUnitRatedFleet(resources) ? "The fleet" : "Available to reserve")}
            {mode === "capacity" && "Upcoming sessions"}
          </h2>

          {mode === "appointment" && (
            <>
              {services.length === 0 ? (
                <p className="mt-4 text-ink-soft">No services are currently listed. Please check back soon.</p>
              ) : (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((s) => (
                    <OfferingCard
                      key={s.id}
                      name={s.name}
                      description={s.description ?? null}
                      imageUrl={s.image_url ?? null}
                      duration={minutesToLabel(s.duration_minutes)}
                      price={formatPrice(s.price)}
                      bookHref={bookHref}
                      ctaLabel="Book"
                      theme={theme}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {mode === "resource" && (
            <>
              {resources.length === 0 ? (
                <p className="mt-4 text-ink-soft">No items are currently listed. Please check back soon.</p>
              ) : isUnitRatedFleet(resources) ? (
                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {resources.map((r) => {
                    const rate = typeof r.metadata.rate === "number" ? r.metadata.rate : null;
                    const weekly = typeof r.metadata.weekly_rate === "number" ? r.metadata.weekly_rate : null;
                    const monthly = typeof r.metadata.monthly_rate === "number" ? r.metadata.monthly_rate : null;
                    const seats = typeof r.metadata.seats === "number" ? r.metadata.seats : null;
                    const specs = [r.metadata.transmission, seats ? `${seats} seats` : null, r.metadata.fuel]
                      .filter(Boolean)
                      .join(" · ");
                    const extraPhotos = Array.isArray(r.images)
                      ? (r.images as unknown[]).filter((u): u is string => typeof u === "string").length
                      : 0;
                    return (
                      <div
                        key={r.id}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card"
                      >
                        <div className="relative aspect-[16/10] w-full bg-ink/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={r.image_url ?? undefined}
                            alt={r.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                          {extraPhotos > 0 && (
                            <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-white">
                              +{extraPhotos} photo{extraPhotos === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-bold text-ink">{r.name}</h3>
                              <p className="mt-1 text-sm text-ink-soft">
                                {[r.metadata.category, specs].filter(Boolean).join(" · ")}
                              </p>
                              {r.description && (
                                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                                  {r.description}
                                </p>
                              )}
                            </div>
                            {rate !== null ? (
                              <p className="text-right font-bold text-ink">
                                Rs {rate.toLocaleString("en-MU")}
                                <span className="block text-xs font-normal text-ink-soft">/ day</span>
                                {weekly !== null && (
                                  <span className="mt-1 block text-xs font-normal text-ink-soft">
                                    Rs {weekly.toLocaleString("en-MU")} / week
                                  </span>
                                )}
                                {monthly !== null && (
                                  <span className="mt-1 block text-xs font-normal text-ink-soft">
                                    Rs {monthly.toLocaleString("en-MU")} / month
                                  </span>
                                )}
                              </p>
                            ) : (
                              <p className="text-right text-sm font-medium text-ink-soft">
                                Contact for price
                              </p>
                            )}
                          </div>
                          <Link
                            href={`${bookHref}?vehicle=${encodeURIComponent(r.id)}`}
                            className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
                          >
                            Rent this car
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {resources.map((r) => (
                    <OfferingCard
                      key={r.id}
                      name={r.name}
                      description={r.description ?? null}
                      imageUrl={r.image_url ?? null}
                      bookHref={bookHref}
                      ctaLabel="Check availability"
                      theme={theme}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {mode === "capacity" && (
            <>
              {sessions.length === 0 ? (
                <p className="mt-4 text-ink-soft">No sessions are currently scheduled. Please check back soon.</p>
              ) : (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sessions.map((s) => {
                    const start = new Date(s.start_time);
                    const date = start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: business.timezone });
                    const time = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: business.timezone });
                    const full = s.remaining <= 0;
                    const parent = services.find((svc) => svc.id === s.service_id) ?? null;
                    return (
                      <OfferingCard
                        key={s.id}
                        name={s.service_name ?? "Session"}
                        description={parent?.description ?? null}
                        imageUrl={parent?.image_url ?? null}
                        capacity={full ? { remaining: 0, total: s.capacity } : { remaining: s.remaining, total: s.capacity }}
                        sessionTime={`${date} · ${time}`}
                        bookHref={bookHref}
                        ctaLabel="Book a spot"
                        theme={theme}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {legacyVisible.gallery && (
          <StorefrontGallery businessName={business.name} images={galleryImages} />
        )}

        {legacyVisible.team && <StorefrontTeam members={teamMembers} />}

        {hours && (
          <section className="mx-auto max-w-[1200px] px-6 py-14 sm:py-16">
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink">Opening hours</h2>
            <div className="mt-6">
              <OpeningHours hours={hours} timezone={business.timezone} />
            </div>
          </section>
        )}

        <LocationSection
          address={business.address ?? null}
          latitude={business.latitude ?? null}
          longitude={business.longitude ?? null}
          businessName={business.name}
        />

        {legacyVisible.reviews && (
          <ReviewsSection reviews={reviews} businessName={business.name} />
        )}

        <ContactSection
          name={business.name}
          phone={business.phone ?? null}
          email={business.email ?? null}
          bookHref={bookHref}
          theme={theme}
        />
      </main>
      <BusinessFooter />
      <MobileStickyCta bookHref={bookHref} primary={theme.primary} />
    </div>
  );
}
