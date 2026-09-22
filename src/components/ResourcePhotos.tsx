"use client";

import { useId, useRef, useState } from "react";
import MediaField from "@/components/storefront/MediaField";
import { storefrontApi, validateImageFile } from "@/components/storefront/api";

/**
 * Cover + extra photos for one rental listing.
 *
 * The cover (MediaField upload or pasted URL) is what cards show; extras
 * appear in the booking lightbox. All persistence is the parent's job —
 * this component only produces URLs via onChange.
 */
export default function ResourcePhotos({
  businessId,
  cover,
  extras,
  disabled,
  onCoverChange,
  onExtrasChange,
}: {
  businessId: string;
  cover: string | null;
  extras: string[];
  disabled?: boolean;
  onCoverChange: (url: string | null) => void;
  onExtrasChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraUrl, setExtraUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const fileId = useId();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;
    const list = Array.from(files).slice(0, 10 - extras.length);
    for (const file of list) {
      const problem = validateImageFile(file);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of list) {
        const { url } = await storefrontApi.uploadMedia(businessId, "resource", file);
        if (!uploaded.includes(url)) uploaded.push(url);
      }
      onExtrasChange([...extras, ...uploaded.filter((u) => u !== cover && !extras.includes(u))].slice(0, 10));
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addExtraUrl() {
    const clean = extraUrl.trim();
    if (!clean) return;
    try {
      const url = new URL(clean);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      setError("Please enter a valid image URL starting with http:// or https://.");
      return;
    }
    if (clean === cover || extras.includes(clean)) {
      setError("That photo is already on this listing.");
      return;
    }
    if (extras.length >= 10) {
      setError("At most 10 extra photos per listing.");
      return;
    }
    setError(null);
    onExtrasChange([...extras, clean]);
    setExtraUrl("");
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...extras];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onExtrasChange(next);
  }

  function makeCover(url: string) {
    const remaining = extras.filter((u) => u !== url);
    if (cover && cover !== url) remaining.unshift(cover);
    onExtrasChange(remaining);
    onCoverChange(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <MediaField
        label="Cover photo"
        hint="Shown on the listing card. Upload or paste a URL below."
        value={cover}
        kind="resource"
        aspect="wide"
        businessId={businessId}
        disabled={disabled}
        onChange={onCoverChange}
      />
      <input
        aria-label="Cover photo URL"
        value={cover ?? ""}
        onChange={(e) => onCoverChange(e.target.value.trim() || null)}
        placeholder="...or paste a cover image URL (https://...)"
        disabled={disabled}
        inputMode="url"
        className="rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-blue disabled:opacity-40"
      />
      <div>
        <p className="text-sm font-medium">
          Extra photos {extras.length > 0 && <span className="font-normal text-ink-soft">({extras.length})</span>}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">Shown in the booking photo viewer.</p>
        {extras.length > 0 && (
          <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {extras.map((url, index) => (
              <li key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 hidden gap-1 bg-ink/70 p-1 group-hover:flex">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => makeCover(url)}
                    title="Set as cover"
                    aria-label={`Set photo ${index + 1} as cover`}
                    className="flex-1 rounded bg-white/20 px-1 py-0.5 text-[11px] font-medium text-white hover:bg-white/30 disabled:opacity-40"
                  >
                    Cover
                  </button>
                  <button
                    type="button"
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Move photo ${index + 1} left`}
                    className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] text-white hover:bg-white/30 disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    disabled={disabled || index === extras.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Move photo ${index + 1} right`}
                    className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] text-white hover:bg-white/30 disabled:opacity-40"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onExtrasChange(extras.filter((u) => u !== url))}
                    aria-label={`Remove photo ${index + 1}`}
                    className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] text-white hover:bg-red-500 disabled:opacity-40"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={disabled || uploading || extras.length >= 10}
            aria-label="Upload extra photos"
            onChange={(event) => handleFiles(event.target.files)}
            className="hidden"
            id={fileId}
          />
          <label
            htmlFor={fileId}
            className={[
              "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-line bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-blue/50",
              disabled || uploading || extras.length >= 10 ? "pointer-events-none opacity-40" : "",
            ].join(" ")}
          >
            {uploading ? "Uploading…" : "Upload photos"}
          </label>
          <input
            aria-label="Extra photo URL"
            value={extraUrl}
            onChange={(e) => setExtraUrl(e.target.value)}
            placeholder="...or paste an image URL"
            disabled={disabled || uploading}
            inputMode="url"
            className="flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-blue disabled:opacity-40"
          />
          <button
            type="button"
            disabled={disabled || uploading || extraUrl.trim().length === 0}
            onClick={addExtraUrl}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-line bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-blue/50 disabled:opacity-40"
          >
            Add URL
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
