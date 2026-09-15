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
        "w-full rounded-xl border p-5 text-left transition-all duration-150",
        selected
          ? "border-blue bg-blue-mist ring-1 ring-blue"
          : "border-line bg-card hover:border-blue/50 hover:bg-blue-mist/40",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={[
              "flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-150",
              selected ? "border-blue bg-blue" : "border-ink-soft/50",
            ].join(" ")}
          >
            {selected && <span className="h-2 w-2 rounded-full bg-white" />}
          </span>
          <span className="text-base font-semibold">{service.name}</span>
        </div>
        <span className="text-base font-semibold tabular-nums">
          {formatPrice(service.price)}
        </span>
      </div>
      {service.description.length > 0 && (
        <p className="mt-2 pl-8 text-sm text-ink-soft">{service.description}</p>
      )}
      <p className="mt-3 pl-8 text-xs font-medium uppercase tracking-wide text-ink-soft">
        {minutesToLabel(service.durationMinutes)} · {businessName}
      </p>
    </button>
  );
}