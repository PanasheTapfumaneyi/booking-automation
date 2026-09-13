import Link from "next/link";

interface ContactSectionProps {
  name: string;
  phone: string | null;
  email: string | null;
  bookHref: string;
  theme: { primary: string };
}

export default function ContactSection({
  name,
  phone,
  email,
  bookHref,
  theme,
}: ContactSectionProps) {
  const hasContact = Boolean(phone || email);

  return (
    <section className="border-t border-line bg-card">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-14 sm:py-16 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">Contact</h2>

          {hasContact ? (
            <div className="mt-5 space-y-2 text-ink-soft">
              {phone && (
                <p>
                  <a
                    href={`tel:${phone.replace(/\s+/g, "")}`}
                    className="font-medium text-ink transition-colors duration-150 hover:underline"
                  >
                    {phone}
                  </a>
                </p>
              )}
              {email && (
                <p>
                  <a
                    href={`mailto:${email}`}
                    className="transition-colors duration-150 hover:underline"
                  >
                    {email}
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-ink-soft">
              Book online — no phone call needed.
            </p>
          )}
        </div>

        <div className="flex items-start">
          <Link
            href={bookHref}
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[15px] font-semibold text-white transition-all duration-150 hover:opacity-90"
            style={{ backgroundColor: theme.primary }}
          >
            Book now
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
