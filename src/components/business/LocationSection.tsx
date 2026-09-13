interface LocationSectionProps {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  businessName: string;
}

export default function LocationSection({ address, latitude, longitude, businessName }: LocationSectionProps) {
  if (!address && latitude === null) return null;

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
    <section className="mx-auto max-w-[1200px] px-6 py-14 sm:py-16">
      <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink">
        Location
      </h2>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.5fr]">
        {address && (
          <div>
            <p className="text-lg leading-relaxed text-ink-soft">{address}</p>
            {mapLinkUrl && (
              <a
                href={mapLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
              >
                Open in Maps
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            )}
          </div>
        )}

        {mapEmbedUrl && (
          <div className="overflow-hidden rounded-2xl border border-line">
            <iframe
              title={`Map of ${businessName}`}
              src={mapEmbedUrl}
              className="h-[280px] w-full border-0 sm:h-[320px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </div>
    </section>
  );
}
