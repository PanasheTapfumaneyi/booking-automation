"use client";

import { useId, useRef, useState } from "react";
import { storefrontApi, validateImageFile } from "./api";

/**
 * Image slot with Upload / Change / Remove. Uploads go through the
 * server media endpoint (service-role, owner-checked); the browser never
 * sees storage credentials or raw paths. Persistence of the resulting URL
 * is the parent's job via onChange — this field only produces URLs.
 */
export default function MediaField({
  label,
  hint,
  value,
  kind,
  aspect,
  businessId,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  kind: "logo" | "cover" | "gallery" | "team";
  aspect: "square" | "wide";
  businessId: string;
  disabled?: boolean;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return;
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { url } = await storefrontApi.uploadMedia(businessId, kind, file);
      onChange(url);
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className={[
            "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-paper",
            aspect === "square" ? "h-24 w-24" : "aspect-video w-full sm:max-w-xs",
          ].join(" ")}
        >
          {uploading ? (
            <span role="status" aria-label="Uploading image" className="flex items-center gap-2 text-sm text-ink-soft">
              <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-blue" />
              Uploading…
            </span>
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-3 text-center text-xs text-ink-soft">No image yet</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || uploading}
            aria-label={value ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
            onChange={(event) => handleFile(event.target.files?.[0])}
            className="hidden"
            id={inputId}
          />
          <label
            htmlFor={inputId}
            className={[
              "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-line bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-blue/50",
              disabled || uploading ? "pointer-events-none opacity-40" : "",
            ].join(" ")}
          >
            {value ? "Change" : "Upload"}
          </label>
          {value && (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => {
                setError(null);
                onChange(null);
              }}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
