import type { Service } from "@/types/booking";
import { formatPrice, DEMO_BUSINESS } from "@/lib/demo";
import { minutesToLabel } from "@/lib/availability";

interface ServiceCardProps {
  service: Service;
  selected: boolean;
  onSelect: (service: Service) => void;
  businessName?: string;
}

export default function ServiceCard({
  service,
  selected,
  onSelect,
  businessName = DEMO_BUSINESS.name,
}: ServiceCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service)}
      aria-pressed={selected}
      className={[
        "w-full overflow-hidden rounded-xl border text-left transition-all duration-150",
        selected
          ? "border-blue bg-blue-mist ring-1 ring-blue"
          : "border-line bg-card hover:border-blue/50 hover:bg-blue-mist/40",
      ].join(" ")}
    >
      {service.imageUrl && (
        <span className="block aspect-[16/9] w-full bg-ink/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={service.imageUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        </span>
      )}
      <span className="block p-5">
        <span className="flex items-start justify-between gap-4">
          <span className="flex items-center gap-3">
            <span
              aria-hidden
              className={[
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                selected ? "border-blue bg-blue" : "border-ink-soft/50",
              ].join(" ")}
            >
              {selected && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <span className="text-base font-semibold">{service.name}</span>
          </span>
          <span className="text-base font-semibold tabular-nums">
            {formatPrice(service.price)}
          </span>
        </span>
        {service.description.length > 0 && (
          <span className="mt-2 block pl-8 text-sm text-ink-soft">{service.description}</span>
        )}
        <span className="mt-3 block pl-8 text-xs font-medium uppercase tracking-wide text-ink-soft">
          {minutesToLabel(service.durationMinutes)} · {businessName}
        </span>
      </span>
    </button>
  );
}
