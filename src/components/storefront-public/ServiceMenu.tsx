import Link from "next/link";
import { minutesToLabel } from "@/lib/availability";
import { formatPrice } from "@/lib/demo";

export interface ServiceMenuItem {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  /** Optional thumbnail shown left of the text. Null = text-only row. */
  imageUrl?: string | null;
}

/**
 * Premium service menu: services grouped in a single bordered card with
 * hairline dividers, generous whitespace, price and duration set tabular.
 * Each row links into booking with the service preselected.
 */
export default function ServiceMenu({
  services,
  bookHref,
  accent,
}: {
  services: ServiceMenuItem[];
  bookHref: string;
  accent: string;
}) {
  if (services.length === 0) return null;
  return (
    <section id="services" aria-labelledby="services-title" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
        <div className="max-w-2xl">
          <h2
            id="services-title"
            className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]"
          >
            Services
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Select a service to continue to booking — your choice carries over automatically.
          </p>
        </div>
        <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <ul className="divide-y divide-line">
            {services.map((service) => (
              <li
                key={service.id}
                className="flex items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-surface-muted/60 sm:px-6"
              >
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  {service.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={service.imageUrl}
                      alt=""
                      aria-hidden="true"
                      className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-line"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[17px] font-semibold leading-snug text-ink">
                      {service.name}
                    </h3>
                    {service.description && (
                      <p className="mt-1 line-clamp-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">{service.description}</p>
                    )}
                    <p className="mt-2 text-sm tabular-nums text-ink-soft">
                      {minutesToLabel(service.durationMinutes)} · <span className="font-semibold text-ink">{formatPrice(service.price)}</span>
                    </p>
                  </div>
                </div>
                <Link
                  href={`${bookHref}?service=${service.id}`}
                  aria-label={`Book ${service.name}`}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow"
                  style={{ backgroundColor: accent }}
                >
                  Book
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
