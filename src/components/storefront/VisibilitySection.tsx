"use client";

import { useState } from "react";
import { storefrontApi } from "./api";
import SectionCard from "./SectionCard";

const FLAGS = [
  { key: "showGallery", label: "Gallery" },
  { key: "showTeam", label: "Team" },
  { key: "showReviews", label: "Reviews" },
  { key: "showAbout", label: "About" },
  { key: "showHours", label: "Opening hours" },
  { key: "showLocation", label: "Location" },
  { key: "showSocial", label: "Social links" },
] as const;

type FlagKey = (typeof FLAGS)[number]["key"];

/**
 * Section visibility toggles. These grant *permission* to show populated
 * sections — an empty gallery or team stays hidden regardless.
 */
export default function VisibilitySection({
  businessId,
  initial,
}: {
  businessId: string;
  initial: Record<FlagKey, boolean>;
}) {
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = FLAGS.some(({ key }) => flags[key] !== initial[key]);

  async function handleSave() {
    setBusy(true);
    setSaved(null);
    setError(null);
    try {
      await storefrontApi.patchStorefront(businessId, { ...flags });
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
      id="section-visibility"
      title="Sections shown on your page"
      description="Permission to show each section. Sections without content stay hidden automatically."
      dirty={dirty}
      busy={busy}
      saved={saved}
      error={error}
      onSave={handleSave}
    >
      <ul className="flex flex-col gap-1">
        {FLAGS.map(({ key, label }) => (
          <li key={key}>
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-paper">
              <span className="text-sm font-medium">{label}</span>
              <input
                type="checkbox"
                checked={flags[key]}
                disabled={busy}
                onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })}
                aria-label={`Show ${label} section`}
                className="h-5 w-5 shrink-0 accent-[#15547D]"
              />
            </label>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
