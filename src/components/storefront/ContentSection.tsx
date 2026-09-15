"use client";

import Link from "next/link";
import { useState } from "react";
import { STOREFRONT_CATEGORIES } from "@/lib/storefront-config";
import { storefrontApi } from "./api";
import SectionCard from "./SectionCard";
import type { ProgressFacts } from "./types";

const CATEGORY_LABELS: Record<string, string> = {
  barber: "Barber / Barbershop",
  beauty_salon: "Beauty salon",
  nail_salon: "Nail salon",
  spa: "Spa",
  tattoo_studio: "Tattoo studio",
  clinic: "Clinic",
  consultant: "Consultant",
  fitness: "Fitness",
  other: "Other",
};

const inputClass =
  "rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-blue disabled:opacity-40";

/**
 * Storefront wording: headline, subheadline, category. Canonical fields
 * (name, tagline, description) stay on the business row — shown here
 * read-only with a link to Business settings so content never forks.
 */
export default function ContentSection({
  businessId,
  businessName,
  tagline,
  description,
  initialHeadline,
  initialSubheadline,
  initialCategory,
  onProgress,
}: {
  businessId: string;
  businessName: string;
  tagline: string | null;
  description: string | null;
  initialHeadline: string | null;
  initialSubheadline: string | null;
  initialCategory: string | null;
  onProgress: (facts: ProgressFacts) => void;
}) {
  const [headline, setHeadline] = useState(initialHeadline ?? "");
  const [subheadline, setSubheadline] = useState(initialSubheadline ?? "");
  const [category, setCategory] = useState(initialCategory ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    headline !== (initialHeadline ?? "") ||
    subheadline !== (initialSubheadline ?? "") ||
    category !== (initialCategory ?? "");

  async function handleSave() {
    setBusy(true);
    setSaved(null);
    setError(null);
    try {
      await storefrontApi.patchStorefront(businessId, {
        headline: headline.trim(),
        subheadline: subheadline.trim(),
        category: category || null,
      });
      onProgress({ headline: headline.trim() || null });
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
      id="section-content"
      title="Business content"
      description="The words customers read first. Your business name, tagline, and description stay in Business settings."
      dirty={dirty}
      busy={busy}
      saved={saved}
      error={error}
      onSave={handleSave}
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Headline
          <span className="text-xs font-normal text-ink-soft">
            A short line that introduces your business.
          </span>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            disabled={busy}
            maxLength={120}
            placeholder={businessName}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Subheadline
          <span className="text-xs font-normal text-ink-soft">
            One sentence explaining what makes the business worth booking.
          </span>
          <input
            value={subheadline}
            onChange={(e) => setSubheadline(e.target.value)}
            disabled={busy}
            maxLength={200}
            placeholder="Sharp cuts, no waiting, book in under a minute."
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Business category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy}
            className={inputClass}
          >
            <option value="">Not set</option>
            {STOREFRONT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value] ?? value}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-xl border border-line bg-paper px-4 py-3 text-sm">
          <p className="font-medium">From Business settings</p>
          <dl className="mt-2 space-y-1 text-ink-soft">
            <div className="flex justify-between gap-4">
              <dt>Name</dt>
              <dd className="text-right font-medium text-ink">{businessName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Tagline</dt>
              <dd className="text-right">{tagline || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>About</dt>
              <dd className="max-w-[60%] truncate text-right">
                {description || "—"}
              </dd>
            </div>
          </dl>
          <Link
            href={`/settings?business=${businessId}`}
            className="mt-2 inline-block text-sm font-medium text-blue-strong hover:underline"
          >
            Edit in Business settings →
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}
