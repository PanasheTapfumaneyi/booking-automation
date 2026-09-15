"use client";

import { useRef, useState } from "react";
import { storefrontApi, validateImageFile } from "./api";
import type { GalleryRow, ProgressFacts } from "./types";

function sorted(items: GalleryRow[]): GalleryRow[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Visual gallery manager: upload, caption/alt editing, featured flag,
 * up/down reorder, two-step remove. Actions sit in an always-visible
 * bar under each image — no hover required (touch-friendly).
 */
export default function GallerySection({
  businessId,
  initial,
  onProgress,
}: {
  businessId: string;
  initial: GalleryRow[];
  onProgress: (facts: ProgressFacts) => void;
}) {
  const [items, setItems] = useState<GalleryRow[]>(() => sorted(initial));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCaption, setDraftCaption] = useState("");
  const [draftAlt, setDraftAlt] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function report(list: GalleryRow[]) {
    onProgress({ galleryCount: list.length });
  }

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return;
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const { url } = await storefrontApi.uploadMedia(businessId, "gallery", file);
      const maxOrder = items.reduce((max, item) => Math.max(max, item.sort_order), -1);
      const created = (await storefrontApi.addGalleryImage(businessId, {
        imageUrl: url,
        sortOrder: maxOrder + 1,
      })) as { image: GalleryRow };
      const next = sorted([...items, created.image]);
      setItems(next);
      report(next);
      setNotice("Image added to your gallery.");
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function startEdit(item: GalleryRow) {
    setEditingId(item.id);
    setDraftCaption(item.caption ?? "");
    setDraftAlt(item.alt_text ?? "");
    setConfirmingId(null);
    setError(null);
  }

  async function saveEdit(item: GalleryRow) {
    setBusyId(item.id);
    setError(null);
    try {
      await storefrontApi.patchGalleryImage(businessId, item.id, {
        caption: draftCaption.trim(),
        altText: draftAlt.trim(),
      });
      setItems((current) =>
        current.map((row) =>
          row.id === item.id
            ? { ...row, caption: draftCaption.trim() || null, alt_text: draftAlt.trim() || null }
            : row,
        ),
      );
      setEditingId(null);
      setNotice("Image updated.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleFeatured(item: GalleryRow) {
    setBusyId(item.id);
    setError(null);
    try {
      await storefrontApi.patchGalleryImage(businessId, item.id, {
        isFeatured: !item.is_featured,
      });
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, is_featured: !row.is_featured } : row)),
      );
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function move(item: GalleryRow, direction: -1 | 1) {
    const ordered = sorted(items);
    const index = ordered.findIndex((row) => row.id === item.id);
    const other = ordered[index + direction];
    if (!other) return;
    setBusyId(item.id);
    setError(null);
    try {
      await storefrontApi.patchGalleryImage(businessId, item.id, { sortOrder: other.sort_order });
      await storefrontApi.patchGalleryImage(businessId, other.id, { sortOrder: item.sort_order });
      setItems((current) =>
        current.map((row) => {
          if (row.id === item.id) return { ...row, sort_order: other.sort_order };
          if (row.id === other.id) return { ...row, sort_order: item.sort_order };
          return row;
        }),
      );
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: GalleryRow) {
    setBusyId(item.id);
    setError(null);
    try {
      await storefrontApi.deleteGalleryImage(businessId, item.id);
      const next = items.filter((row) => row.id !== item.id);
      setItems(next);
      setConfirmingId(null);
      report(next);
      setNotice("Image removed.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      id="section-gallery"
      aria-labelledby="section-gallery-title"
      className="scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-6"
    >
      <h2 id="section-gallery-title" className="text-lg font-semibold tracking-tight">
        Gallery
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Portfolio photos for your storefront. The gallery hides publicly until you add images.
      </p>

      <div aria-live="polite">
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm text-ink-soft">
            {notice}
          </p>
        )}
      </div>

      {items.length === 0 && !uploading ? (
        <div className="mt-4 rounded-xl border border-dashed border-line bg-paper p-6 text-center">
          <p className="font-medium">No gallery images yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Add a few photos of your work or space — customers love seeing them.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-xl border border-line bg-paper"
            >
              <div className="relative aspect-square bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.alt_text || item.caption || "Gallery image"}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {item.is_featured && (
                  <span className="absolute left-2 top-2 rounded-full bg-blue px-2 py-0.5 text-[11px] font-semibold text-white">
                    Featured
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-1.5 py-1.5">
                <span className="min-w-0 flex-1 truncate px-1 text-xs text-ink-soft">
                  {item.caption || `Photo ${index + 1}`}
                </span>
                <div className="flex shrink-0 items-center" role="group" aria-label={`Actions for ${item.caption || `photo ${index + 1}`}`}>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => toggleFeatured(item)}
                    aria-pressed={item.is_featured}
                    title={item.is_featured ? "Unmark as featured" : "Mark as featured"}
                    aria-label={item.is_featured ? "Unmark as featured" : "Mark as featured"}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted disabled:opacity-40 ${item.is_featured ? "text-blue" : "text-ink-soft"}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill={item.is_featured ? "currentColor" : "none"} aria-hidden="true">
                      <path d="M8 1.5l2.1 4.4 4.9.7-3.5 3.4.8 4.9L8 12.7l-4.3 2.2.8-4.9L1 6.6l4.9-.7L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null || index === 0}
                    onClick={() => move(item, -1)}
                    title="Move earlier"
                    aria-label="Move photo earlier"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-30"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M7 12V2M3 6l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null || index === items.length - 1}
                    onClick={() => move(item, 1)}
                    title="Move later"
                    aria-label="Move photo later"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-30"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M7 2v10M3 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => startEdit(item)}
                    title="Edit caption"
                    aria-label="Edit photo caption"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-40"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M9.5 2.5l2 2L4 12H2V10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {confirmingId === item.id ? (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => remove(item)}
                      title="Confirm remove"
                      aria-label="Confirm remove photo"
                      className="flex h-9 items-center justify-center rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
                    >
                      {busyId === item.id ? "…" : "Sure?"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => {
                        setConfirmingId(item.id);
                        setEditingId(null);
                      }}
                      title="Remove photo"
                      aria-label="Remove photo"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-muted hover:text-red-600 disabled:opacity-40"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M2.5 3.5h9M5.5 3V2h3v1M4 3.5l.7 8h4.6l.7-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {editingId === item.id && (
                <div className="border-t border-line px-3 py-3">
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Caption
                    <input
                      value={draftCaption}
                      onChange={(e) => setDraftCaption(e.target.value)}
                      disabled={busyId !== null}
                      maxLength={140}
                      className="rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal outline-none focus:border-blue disabled:opacity-40"
                    />
                  </label>
                  <label className="mt-2 flex flex-col gap-1 text-xs font-medium">
                    Alt text
                    <input
                      value={draftAlt}
                      onChange={(e) => setDraftAlt(e.target.value)}
                      disabled={busyId !== null}
                      maxLength={140}
                      placeholder="Describe the photo for screen readers"
                      className="rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal outline-none focus:border-blue disabled:opacity-40"
                    />
                  </label>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => saveEdit(item)}
                      className="rounded-full bg-blue px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-strong disabled:opacity-40"
                    >
                      {busyId === item.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink-soft hover:text-ink disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {uploading && (
            <li
              aria-hidden="true"
              className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line bg-paper"
            >
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-blue" />
            </li>
          )}
        </ul>
      )}

      <div className="mt-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          aria-label="Upload a gallery image"
          onChange={(event) => handleFile(event.target.files?.[0])}
          className="hidden"
          id="gallery-upload"
        />
        <label
          htmlFor="gallery-upload"
          className={[
            "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:border-blue/50",
            uploading ? "pointer-events-none opacity-40" : "",
          ].join(" ")}
        >
          {uploading ? "Uploading…" : items.length === 0 ? "Upload your first photo" : "Add photo"}
        </label>
      </div>
    </section>
  );
}
