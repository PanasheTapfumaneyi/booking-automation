import type { SocialEntry } from "@/lib/storefront-public";

function SocialIcon({ network }: { network: string }) {
  const common = "fill-none";
  switch (network) {
    case "instagram":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="14.5" cy="5.5" r="1.2" fill="currentColor" />
        </svg>
      );
    case "facebook":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M13.5 7H11V5.5c0-.8.2-1 1-1h1.5V2H11c-2.2 0-3 1.6-3 3.2V7H5.5v2.5H8V18h3V9.5h2.3L13.5 7z" fill="currentColor" />
        </svg>
      );
    case "tiktok":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M12.5 2v10.5a3.75 3.75 0 1 1-3.75-3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12.5 5.5c.8 1.8 2.3 2.8 4.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 2a7.5 7.5 0 0 0-6.4 11.3L2.5 17.5l4.3-1.1A7.5 7.5 0 1 0 10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7.5 7c.3 2.7 2.3 4.7 5 5l1-1.5 2 1c-.3 1.6-1.7 2.5-3.2 2-3.3-1-5.8-3.5-6.8-6.8-.5-1.5.4-2.9 2-3.2l1 2L7.5 7z" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={common}>
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.5 10h15M10 2.5c-4.5 4.6-4.5 10.4 0 15M10 2.5c4.5 4.6 4.5 10.4 0 15" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
  }
}

/**
 * Compact follow row: configured networks only, recognizable icons,
 * touch-sized targets. Never dominates the page.
 */
export default function StorefrontSocial({
  businessName,
  entries,
}: {
  businessName: string;
  entries: SocialEntry[];
}) {
  if (entries.length === 0) return null;
  return (
    <section aria-label={`Follow ${businessName}`} className="border-t border-line/70">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-8">
        <p className="text-sm font-semibold text-ink">Follow {businessName}</p>
        <ul className="flex flex-wrap items-center gap-2">
          {entries.map((entry) => (
            <li key={entry.network}>
              <a
                href={entry.href}
                target={entry.network === "website" ? undefined : "_blank"}
                rel={entry.network === "website" ? undefined : "noopener noreferrer"}
                aria-label={`${businessName} on ${entry.label}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
              >
                <SocialIcon network={entry.network} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
