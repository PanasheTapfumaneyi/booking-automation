"use client";

import type { FormEvent, ReactNode } from "react";

/**
 * Uniform section shell for the storefront editor: title, supporting
 * copy, dirty hint, error/success messaging, and one explicit Save.
 * Matches the settings-form save conventions (no silent discards, no
 * modal success).
 */
export default function SectionCard({
  id,
  title,
  description,
  dirty,
  busy,
  saved,
  error,
  saveLabel = "Save changes",
  children,
  onSave,
}: {
  id: string;
  title: string;
  description?: string;
  dirty: boolean;
  busy: boolean;
  saved: string | null;
  error: string | null;
  saveLabel?: string;
  children: ReactNode;
  onSave: () => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-6"
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      <form onSubmit={handleSubmit} className="mt-4">
        {children}
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        {saved && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {saved}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!dirty || busy}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Saving…" : saveLabel}
          </button>
          {dirty && !busy && (
            <p role="status" className="text-xs font-medium text-blue-strong">
              Unsaved changes
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
