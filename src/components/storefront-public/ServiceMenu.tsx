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
 * Premium service menu: hairline rows, generous whitespace, price and
 * duration set tabular. Each row links into booking with the service
 * preselected — no reselection needed.
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
      <div className="mx-auto w-full max-w-4xl px-5 py-14 sm:py-20">
        <h2
          id="services-title"
          className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink"
        >
          Services
        </h2>
        <ul className="mt-8 grid gap-x-12 md:grid-cols-2">
          {services.map((service) => (
            <li
              key={service.id}
              className="flex items-start justify-between gap-4 border-b border-line/80 py-5 first:border-t md:first:border-t-0 md:[&:nth-child(2)]:border-t"
            >
              {service.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={service.imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold leading-snug text-ink">
                  {service.name}
                </h3>
                {service.description && (
                  <p className="mt-1 leading-relaxed text-ink-soft">{service.description}</p>
                )}
                <p className="mt-2 text-sm tabular-nums text-ink-soft">
                  {minutesToLabel(service.durationMinutes)} · {formatPrice(service.price)}
                </p>
              </div>
              <Link
                href={`${bookHref}?service=${service.id}`}
                aria-label={`Book ${service.name}`}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Book
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
