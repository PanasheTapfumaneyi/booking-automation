"use client";

import { useState } from "react";

/** Copies the public booking URL. Falls back to selecting the text. */
export default function CopyBookingLink({ slug }: { slug: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!slug) return null;
  const url = `/book/${slug}`;

  async function copy() {
    const absolute = `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(absolute);
    } catch {
      window.prompt("Copy your booking link:", absolute);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:text-ink"
      title={url}
    >
      {copied ? "Copied!" : "Copy booking link"}
    </button>
  );
}
