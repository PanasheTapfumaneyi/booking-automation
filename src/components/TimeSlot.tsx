import { minutesToLabel } from "@/lib/availability";

interface TimeSlotProps {
  label: string;
  durationMinutes: number;
  selected: boolean;
  onSelect: () => void;
}

export default function TimeSlot({
  label,
  durationMinutes,
  selected,
  onSelect,
}: TimeSlotProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "flex items-baseline justify-between rounded-lg border px-4 py-3 transition-all",
        selected
          ? "border-blue bg-blue text-white"
          : "border-line bg-card hover:border-blue hover:bg-blue-soft/50",
      ].join(" ")}
    >
      <span className="text-base font-semibold tabular-nums">{label}</span>
      <span className="text-xs opacity-70">
        {minutesToLabel(durationMinutes)}
      </span>
    </button>
  );
}