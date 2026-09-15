"use client";

import { useState } from "react";
import { STOREFRONT_AMENITIES } from "@/lib/storefront-config";
import { storefrontApi } from "./api";
import SectionCard from "./SectionCard";

/**
 * Controlled amenity chips from the shared allowlist (same constant the
 * server validates against — the UI cannot drift). Compact by design.
 */
export default function AmenitiesSection({
  businessId,
  initial,
}: {
  businessId: string;
  initial: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    selected.length !== initial.length || selected.some((item) => !initial.includes(item));

  function toggle(amenity: string) {
    setSelected((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity],
    );
  }

  async function handleSave() {
    setBusy(true);
    setSaved(null);
    setError(null);
    try {
      await storefrontApi.patchStorefront(businessId, { amenities: selected });
      setSaved("Storefront updated.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      id="section-amenities"
      title="Amenities"
      description="Practical comforts customers appreciate. Shown as small highlights."
      dirty={dirty}
      busy={busy}
      saved={saved}
      error={error}
      onSave={handleSave}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Amenities">
        {STOREFRONT_AMENITIES.map((amenity) => {
          const active = selected.includes(amenity);
          return (
            <button
              key={amenity}
              type="button"
              disabled={busy}
              onClick={() => toggle(amenity)}
              aria-pressed={active}
              className={[
                "min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40",
                active
                  ? "border-blue bg-blue-soft text-blue-strong"
                  : "border-line bg-paper text-ink-soft hover:border-blue/50 hover:text-ink",
              ].join(" ")}
            >
              {amenity}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
