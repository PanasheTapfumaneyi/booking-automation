"use client";

import { useState } from "react";
import { SOCIAL_LABELS, SOCIAL_NETWORKS, type SocialNetwork } from "@/lib/storefront-config";
import { storefrontApi } from "./api";
import SectionCard from "./SectionCard";
import type { ProgressFacts } from "./types";

const inputClass =
  "rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-blue disabled:opacity-40";

/**
 * Constrained social inputs: only supported networks, URL-validated,
 * no HTML or widgets. Empty networks are omitted publicly.
 */
export default function SocialSection({
  businessId,
  initial,
  onProgress,
}: {
  businessId: string;
  initial: Partial<Record<SocialNetwork, string>>;
  onProgress: (facts: ProgressFacts) => void;
}) {
  const [values, setValues] = useState<Record<SocialNetwork, string>>({
    instagram: initial.instagram ?? "",
    facebook: initial.facebook ?? "",
    tiktok: initial.tiktok ?? "",
    website: initial.website ?? "",
    whatsapp: initial.whatsapp ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = SOCIAL_NETWORKS.some(
    (network) => values[network] !== (initial[network] ?? ""),
  );

  async function handleSave() {
    setBusy(true);
    setSaved(null);
    setError(null);
    try {
      const links: Record<string, string> = {};
      for (const network of SOCIAL_NETWORKS) {
        if (values[network].trim()) links[network] = values[network].trim();
      }
      await storefrontApi.patchStorefront(businessId, { socialLinks: links });
      onProgress({ socialCount: Object.keys(links).length });
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
      id="section-social"
      title="Social links"
      description="Where customers can find you elsewhere. Empty fields stay hidden."
      dirty={dirty}
      busy={busy}
      saved={saved}
      error={error}
      onSave={handleSave}
    >
      <div className="flex flex-col gap-3">
        {SOCIAL_NETWORKS.map((network) => (
          <label key={network} className="flex flex-col gap-1 text-sm font-medium">
            {SOCIAL_LABELS[network]}
            <input
              value={values[network]}
              onChange={(e) => setValues({ ...values, [network]: e.target.value })}
              disabled={busy}
              inputMode="url"
              placeholder={network === "website" ? "https://…" : `https://${network}.com/…`}
              className={inputClass}
            />
          </label>
        ))}
      </div>
    </SectionCard>
  );
}
