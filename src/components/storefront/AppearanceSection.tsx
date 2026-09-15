"use client";

import { useState } from "react";
import { ACCENT_PRESETS } from "@/lib/storefront-config";
import { storefrontApi } from "./api";
import MediaField from "./MediaField";
import SectionCard from "./SectionCard";
import type { ProgressFacts } from "./types";

const inputClass =
  "rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-blue disabled:opacity-40";

/**
 * Appearance: logo, cover image (immediate upload/remove), and a
 * constrained accent colour (explicit save). Template selection stays
 * internal while only one real design exists.
 */
export default function AppearanceSection({
  businessId,
  initialLogo,
  initialCover,
  initialPrimary,
  onProgress,
}: {
  businessId: string;
  initialLogo: string | null;
  initialCover: string | null;
  initialPrimary: string;
  onProgress: (facts: ProgressFacts) => void;
}) {
  const [logo, setLogo] = useState(initialLogo);
  const [cover, setCover] = useState(initialCover);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [accent, setAccent] = useState(initialPrimary);
  const [customHex, setCustomHex] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveChoice = customHex.trim() || accent;
  const accentDirty = effectiveChoice.toLowerCase() !== initialPrimary.toLowerCase();

  async function persistMedia(field: "logoUrl" | "coverUrl", url: string | null) {
    setMediaBusy(true);
    setMediaNote(null);
    setMediaError(null);
    try {
      await storefrontApi.patchStorefront(businessId, { [field]: url });
      if (field === "logoUrl") {
        setLogo(url);
        onProgress({ logoUrl: url });
      } else {
        setCover(url);
        onProgress({ coverUrl: url });
      }
      setMediaNote(url ? "Image updated." : "Image removed.");
    } catch (saveError: unknown) {
      setMediaError(
        saveError instanceof Error ? saveError.message : "Something went wrong. Please try again.",
      );
    } finally {
      setMediaBusy(false);
    }
  }

  async function handleLogoChange(url: string | null) {
    if (url === null && logo) {
      // Best-effort storage cleanup (external hotlinks are skipped
      // server-side — remote providers are never touched).
      await storefrontApi.deleteMediaUrl(businessId, logo).catch(() => undefined);
    }
    await persistMedia("logoUrl", url);
  }

  async function handleCoverChange(url: string | null) {
    if (url === null && cover) {
      await storefrontApi.deleteMediaUrl(businessId, cover).catch(() => undefined);
    }
    await persistMedia("coverUrl", url);
  }

  function pickPreset(value: string) {
    setAccent(value);
    setCustomHex("");
    setSaved(null);
    setError(null);
  }

  async function handleSaveAccent() {
    const chosen = customHex.trim() || accent;
    if (!/^#[0-9a-f]{6}$/i.test(chosen)) {
      setError("Please enter a valid colour like #15547D.");
      return;
    }
    setBusy(true);
    setSaved(null);
    setError(null);
    try {
      await storefrontApi.patchStorefront(businessId, {
        themePrimary: chosen,
        themeAccent: chosen,
      });
      setAccent(chosen);
      setCustomHex("");
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
      id="section-appearance"
      title="Appearance"
      description="Logo, cover image, and accent colour for your public page."
      dirty={accentDirty}
      busy={busy}
      saved={saved}
      error={error}
      onSave={handleSaveAccent}
    >
      <div className="flex flex-col gap-6">
        <MediaField
          label="Logo"
          hint="Shown beside your business name. Square images work best."
          value={logo}
          kind="logo"
          aspect="square"
          businessId={businessId}
          disabled={mediaBusy}
          onChange={handleLogoChange}
        />
        <MediaField
          label="Cover image"
          hint="Shown prominently at the top of your storefront."
          value={cover}
          kind="cover"
          aspect="wide"
          businessId={businessId}
          disabled={mediaBusy}
          onChange={handleCoverChange}
        />
        {(mediaNote || mediaError) && (
          <p role={mediaError ? "alert" : "status"} className={`text-sm ${mediaError ? "text-red-700" : "text-ink-soft"}`}>
            {mediaError ?? mediaNote}
          </p>
        )}
        <div>
          <p className="text-sm font-medium">Accent colour</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Used for buttons and highlights. Every choice keeps text readable.
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Accent colour presets">
            {ACCENT_PRESETS.map((preset) => {
              const selected = accent.toLowerCase() === preset.value.toLowerCase() && !customHex;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => pickPreset(preset.value)}
                  aria-pressed={selected}
                  title={preset.name}
                  aria-label={`${preset.name} (${preset.value})`}
                  style={{ backgroundColor: preset.value }}
                  className={[
                    "h-10 w-10 rounded-full border transition-all",
                    selected
                      ? "border-blue ring-2 ring-blue ring-offset-2 ring-offset-card"
                      : "border-line hover:scale-105",
                  ].join(" ")}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              Custom
              <input
                value={customHex}
                onChange={(e) => {
                  setCustomHex(e.target.value);
                  setSaved(null);
                  setError(null);
                }}
                placeholder="#15547D"
                maxLength={7}
                disabled={busy}
                className={`${inputClass} w-28 tabular-nums`}
              />
            </label>
            <span
              aria-hidden="true"
              className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: effectiveChoice }}
            >
              Preview
            </span>
            <span className="text-xs text-ink-soft">
              Current: <span className="tabular-nums">{initialPrimary}</span>
            </span>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
