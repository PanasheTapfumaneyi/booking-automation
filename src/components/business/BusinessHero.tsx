import Link from "next/link";

interface BusinessHeroProps {
  name: string;
  tagline: string | null;
  mode: string;
  coverImageUrl: string | null;
  logoUrl: string | null;
  bookHref: string;
  phone: string | null;
  theme: { primary: string; foreground: string; background: string; surface: string };
}

const MODE_LABEL: Record<string, string> = {
  Appointments: "Appointments",
  Rentals: "Rentals",
  "Classes & Tours": "Classes & Tours",
  appointment: "Appointments",
  resource: "Rentals",
  capacity: "Classes & Tours",
};

export default function BusinessHero({
  name,
  tagline,
  mode,
  coverImageUrl,
  logoUrl,
  bookHref,
  phone,
  theme,
}: BusinessHeroProps) {
  const hasCover = Boolean(coverImageUrl);
  const displayMode = MODE_LABEL[mode] ?? "Bookings";

  return (
    <section
      className="relative overflow-hidden border-b border-line"
      style={hasCover ? undefined : { backgroundColor: theme.background }}
    >
      {hasCover && (
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${coverImageUrl})` }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(8,8,8,0.72) 0%, rgba(8,8,8,0.42) 45%, rgba(8,8,8,0.18) 100%), linear-gradient(180deg, rgba(8,8,8,0.14) 0%, transparent 40%)",
            }}
          />
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 py-20 sm:py-28">
        <div className={hasCover ? "max-w-2xl text-white" : "max-w-2xl"}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={`${name} logo`}
              decoding="async"
              className="mb-5 h-16 w-16 rounded-xl object-contain bg-white/90 p-1.5 shadow-sm"
            />
          )}

          <p
            className="text-sm font-semibold uppercase tracking-[0.18em]"
            style={hasCover ? { color: "rgba(255,255,255,0.85)" } : { color: theme.primary }}
          >
            {displayMode}
          </p>

          <h1
            className={[
              "mt-4 text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.05] tracking-tight",
              hasCover ? "text-white" : "text-ink",
            ].join(" ")}
          >
            {name}
          </h1>

          {tagline && (
            <p
              className={[
                "mt-4 text-lg leading-relaxed",
                hasCover ? "text-white/85" : "text-ink-soft",
              ].join(" ")}
            >
              {tagline}
            </p>
          )}

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={bookHref}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-7 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:opacity-90"
              style={{ backgroundColor: theme.primary }}
            >
              Book now
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            {phone && (
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className={[
                  "inline-flex items-center justify-center rounded-lg border px-7 py-3.5 text-base font-medium transition-all duration-150",
                  hasCover
                    ? "border-white/40 text-white hover:border-white/70 hover:text-white"
                    : "border-line text-ink-soft hover:border-line-strong hover:text-ink",
                ].join(" ")}
                style={!hasCover ? { backgroundColor: theme.surface } : undefined}
              >
                {phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}