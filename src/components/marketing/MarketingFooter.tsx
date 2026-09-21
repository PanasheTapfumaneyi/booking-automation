import Link from "next/link";
import { whatsappUrl, telUrl } from "@/lib/marketing-config";
import { TrackedLink } from "@/components/marketing/TrackedLink";

export default function MarketingFooter() {
  const wa = whatsappUrl();
  const tel = telUrl();

  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5">
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect width="28" height="28" rx="7" fill="#13847D" />
                <path d="M8 10.5C8 9.67 8.67 9 9.5 9H13.5C15.43 9 17 10.57 17 12.5C17 14.43 15.43 16 13.5 16H9.5C8.67 16 8 15.33 8 14.5V10.5Z" fill="white" opacity="0.9" />
                <path d="M12 16L12 19.5C12 20.33 12.67 21 13.5 21H18.5C19.33 21 20 20.33 20 19.5V13.5C20 12.67 19.33 12 18.5 12H12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-lg font-bold tracking-tight text-ink">Kivo</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Simple digital booking and reservations for businesses that need their time back.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {wa && (
                <TrackedLink
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  eventName="contact_clicked"
                  eventProps={{ contact_type: "whatsapp", cta_location: "footer" }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:border-line-strong hover:text-ink"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor"/>
                  </svg>
                  WhatsApp
                </TrackedLink>
              )}
              {tel && (
                <TrackedLink
                  href={tel}
                  eventName="contact_clicked"
                  eventProps={{ contact_type: "phone", cta_location: "footer" }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:border-line-strong hover:text-ink"
                >
                  Call us
                </TrackedLink>
              )}
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm" aria-label="Footer navigation">
            <Link href="/#product" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Product</Link>
            <Link href="/#solutions" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Solutions</Link>
            <Link href="/pricing" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Pricing</Link>
            <Link href="/#how-it-works" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">How It Works</Link>
            <Link href="/demo" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Live sites</Link>
            <Link href="/about" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">About</Link>
            <Link href="/contact" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Contact</Link>
            <Link href="/login" className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Business login</Link>
            <TrackedLink href="/signup" eventName="start_free_clicked" eventProps={{ cta_location: "footer", cta_label: "Get Started" }} className="font-medium text-ink-soft transition-colors duration-150 hover:text-ink">Get Started</TrackedLink>
          </nav>
        </div>

        <div className="mt-10 border-t border-line pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-muted">&copy; {new Date().getFullYear()} Kivo. All rights reserved.</p>
            <div className="flex gap-4 text-xs">
              <Link href="/privacy" className="text-muted transition-colors duration-150 hover:text-ink-soft">Privacy</Link>
              <Link href="/terms" className="text-muted transition-colors duration-150 hover:text-ink-soft">Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
