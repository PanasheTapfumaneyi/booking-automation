"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Client-side slug preview (server re-validates; this is display only). */
function previewSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "business";
}

export default function DuplicateBusinessButton({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${businessName} (Copy)`);
  const [slug, setSlug] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [includeSessions, setIncludeSessions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDuplicate() {
    if (name.trim().length < 2) {
      setError("Please give the new business a name (2–80 characters).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || null,
          ownerUserId: ownerUserId.trim() || null,
          includeFutureSessions: includeSessions,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: { userMessage?: string };
        business?: { id: string; slug: string };
      } | null;
      if (!res.ok || !data?.business) {
        throw new Error(data?.error?.userMessage ?? "Duplication failed.");
      }
      router.push(`/settings?business=${data.business.id}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
      >
        Duplicate
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-line bg-paper p-3">
      <p className="text-xs font-semibold">
        Duplicate &ldquo;{businessName}&rdquo;
      </p>
      <p className="text-xs text-ink-soft">
        Copies services, items, future sessions, theme, gallery and team into a
        new live business. Reviews, customers, bookings and contact details never
        copy. The new page goes live immediately.
      </p>
      <label className="flex flex-col gap-1 text-xs font-medium">
        New business name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Prospect business name"
          disabled={busy}
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs outline-none focus:border-blue"
        />
      </label>
      <p className="text-xs text-ink-soft">
        Booking link: /{slug.trim() ? slug.trim().toLowerCase() : previewSlug(name)}
      </p>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Custom booking link (optional)
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="leave blank to auto-generate"
          disabled={busy}
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs outline-none focus:border-blue"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Owner user ID (optional, defaults to you)
        <input
          value={ownerUserId}
          onChange={(e) => setOwnerUserId(e.target.value)}
          placeholder="defaults to you"
          disabled={busy}
          className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs outline-none focus:border-blue"
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={includeSessions}
          onChange={(e) => setIncludeSessions(e.target.checked)}
          disabled={busy}
          className="h-4 w-4 accent-[#15547D]"
        />
        Copy upcoming sessions
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || name.trim().length < 2}
          onClick={handleDuplicate}
          className="rounded-lg bg-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-strong disabled:opacity-40"
        >
          {busy ? "Duplicating…" : "Create duplicate"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
          disabled={busy}
        >
          Cancel
        </button>
      </div>
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}
