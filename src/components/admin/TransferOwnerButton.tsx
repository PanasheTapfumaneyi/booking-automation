"use client";

import { useState } from "react";

export default function TransferOwnerButton({
  businessId,
}: {
  businessId: string;
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleTransfer() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/transfer-owner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerUserId: userId.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.userMessage ?? "Transfer failed.");
      }
      setSuccess(true);
      setUserId("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <span className="text-xs text-emerald-600 font-medium">
        Owner transferred
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
      >
        Transfer Owner
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="New owner user ID"
        className="w-48 rounded-lg border border-line bg-card px-3 py-1.5 text-xs outline-none focus:border-blue"
        disabled={busy}
      />
      <button
        type="button"
        disabled={busy || userId.trim().length < 10}
        onClick={handleTransfer}
        className="rounded-lg bg-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-strong disabled:opacity-40"
      >
        {busy ? "..." : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setError(null); }}
        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
        disabled={busy}
      >
        Cancel
      </button>
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}
