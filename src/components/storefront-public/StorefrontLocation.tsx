/**
 * Location + contact pairing: address, restrained map, directions, and
 * selective public contact actions. Hides cleanly when nothing exists.
 */
export default function StorefrontLocation({
  address,
  latitude,
  longitude,
  businessName,
  phone,
  email,
  accent,
}: {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  businessName: string;
  phone: string | null;
  email: string | null;
  accent: string;
}) {
  if (!address && latitude === null && !phone && !email) return null;

  const hasCoords = typeof latitude === "number" && typeof longitude === "number";
  const mapEmbedUrl = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`
    : null;
  const mapLinkUrl = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`
    : address
      ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`
      : null;

  return (
    <section id="location" aria-labelledby="location-title" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
        <h2
          id="location-title"
          className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink"
        >
          Visit us
        </h2>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <div className="min-w-0">
            {address && (
              <p className="max-w-md text-lg leading-relaxed text-ink-soft">{address}</p>
            )}
            <div className="mt-5 flex flex-col items-start gap-2.5">
              {mapLinkUrl && (
                <a
                  href={mapLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold transition-colors hover:underline"
                  style={{ color: accent }}
                >
                  Get directions
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
              {phone && (
                <a
                  href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-card px-5 py-2 text-sm font-semibold text-ink transition-colors hover:border-line-strong"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 2h3l1.5 4-2 1.5c.8 1.7 2 2.9 3.7 3.7L10.5 9l4 1.5v3c0 .6-.4 1-1 1C7.6 14.5 1.5 8.4 1.5 2.5c0-.3.7-.5 1.5-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                  {phone}
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-card px-5 py-2 text-sm font-semibold text-ink transition-colors hover:border-line-strong"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M2.5 4.5L8 9l5.5-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {email}
                </a>
              )}
              {!phone && !email && (
                <p className="text-sm text-ink-soft">Book online — no phone call needed.</p>
              )}
            </div>
          </div>
          {mapEmbedUrl && (
            <div className="overflow-hidden rounded-2xl border border-line">
              <iframe
                title={`Map of ${businessName}`}
                src={mapEmbedUrl}
                className="h-[260px] w-full border-0 sm:h-[300px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
