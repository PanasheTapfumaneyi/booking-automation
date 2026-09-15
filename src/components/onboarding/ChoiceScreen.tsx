"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMarketingSession, trackMarketingEvent } from "@/lib/marketing-analytics";

/**
 * "How would you like to get started?" — managed (recommended) vs
 * self-configuration. Posts the idempotent choice endpoint: repeating a
 * choice rewrites the same row and only alerts Kivo on first/changed
 * choice, so refresh/retry is safe.
 */
export default function ChoiceScreen({
  businessId,
  businessName,
  initialContact,
}: {
  businessId: string;
  businessName: string;
  initialContact: string;
}) {
  const router = useRouter();
  const [contact, setContact] = useState(initialContact);
  const [busy, setBusy] = useState<"managed" | "self" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackMarketingEvent("setup_choice_viewed", {});
  }, []);

  async function choose(preference: "managed" | "self") {
    if (busy) return;
    setBusy(preference);
    setError(null);
    try {
      const response = await fetch("/api/onboarding/choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          preference,
          contactPhone: contact.trim(),
          sessionId: getMarketingSession()?.id ?? undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: { userMessage?: string };
      } | null;
      if (!response.ok) {
        throw new Error(data?.error?.userMessage ?? "Something went wrong. Please try again.");
      }
      router.push(preference === "managed" ? "/onboarding/success" : "/onboarding");
      router.refresh();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const cardClass =
    "flex w-full flex-col rounded-2xl border p-6 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        How would you like to get started, {businessName}?
      </h1>
      <p className="mt-2 text-ink-soft">
        Choose how you&apos;d like to set up Kivo. You can let us handle
        everything, or start configuring your booking page yourself.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <label className="mt-6 flex flex-col gap-1.5 text-sm font-medium">
        Your WhatsApp number
        <span className="text-xs font-normal text-ink-soft">
          Kivo contacts you here about your setup — confirm it&apos;s correct.
        </span>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          disabled={busy !== null}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-blue disabled:opacity-40"
          placeholder="+230 …"
        />
      </label>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => choose("managed")}
          aria-label="Recommended: let Kivo handle the setup"
          className={`${cardClass} relative border-blue bg-blue-mist/60 hover:border-blue hover:shadow-[0_4px_16px_rgba(21,84,125,0.12)]`}
        >
          <span className="absolute -top-3 left-5 rounded-full bg-blue px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
            Recommended
          </span>
          <span className="mt-1 text-lg font-bold">Let Kivo handle the setup</span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
            We&apos;ll configure your booking page, services, opening hours
            and booking settings for you. We&apos;ll contact you shortly to
            get the details we need.
          </span>
          <span className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full bg-blue px-6 py-3 text-base font-semibold text-white">
            {busy === "managed" ? "Saving…" : "Set it up for me"}
          </span>
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => choose("self")}
          aria-label="Configure Kivo yourself"
          className={`${cardClass} border-line bg-card hover:border-blue/50`}
        >
          <span className="mt-1 text-lg font-bold">Configure it now</span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
            Want to explore Kivo yourself? Add your services, prices, opening
            hours and booking preferences now — and test your booking page
            immediately. We&apos;ll still contact you to help finalize
            everything before you go live.
          </span>
          <span className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-full border border-blue/40 px-6 py-3 text-base font-semibold text-blue-strong">
            {busy === "self" ? "Saving…" : "Start configuring"}
          </span>
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Either way, Kivo stays involved — we review every setup with you
        before your business goes live.
      </p>
    </div>
  );
}
