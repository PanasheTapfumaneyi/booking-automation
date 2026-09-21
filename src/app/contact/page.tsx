import type { Metadata } from "next";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";
import { whatsappUrl, telUrl } from "@/lib/marketing-config";

export const metadata: Metadata = {
  title: "Contact Kivo — Get in touch",
  description:
    "Have questions about Kivo? Reach out via WhatsApp, phone or email. We help Mauritian businesses get set up with online booking.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "Contact Kivo — Get in touch",
    description:
      "Have questions about Kivo? Reach out via WhatsApp, phone or email. We help Mauritian businesses get set up with online booking.",
    url: `${SITE_URL}/contact`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Kivo — Get in touch",
    description:
      "Have questions about Kivo? Reach out via WhatsApp, phone or email. We help Mauritian businesses get set up with online booking.",
    images: [OG_IMAGE],
  },
};

export default function ContactPage() {
  const wa = whatsappUrl();
  const tel = telUrl();

  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-28">
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
            Contact us
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Have questions about Kivo? We&apos;re here to help you get started
            with online booking for your business.
          </p>

          <div className="mt-10 space-y-4">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-line bg-card p-5 text-ink transition-all hover:border-brand hover:text-brand"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor"/>
                </svg>
                <div>
                  <p className="font-semibold">WhatsApp</p>
                  <p className="text-sm text-ink-soft">Chat with us directly</p>
                </div>
              </a>
            )}
            {tel && (
              <a
                href={tel}
                className="flex items-center gap-3 rounded-xl border border-line bg-card p-5 text-ink transition-all hover:border-brand hover:text-brand"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <p className="font-semibold">Phone</p>
                  <p className="text-sm text-ink-soft">Give us a call</p>
                </div>
              </a>
            )}
            <div className="rounded-xl border border-line bg-card p-5">
              <p className="font-semibold text-ink">Email</p>
              <p className="mt-1 text-sm text-ink-soft">
                For general enquiries, reach out via WhatsApp or phone. We
                respond quickly during business hours.
              </p>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
