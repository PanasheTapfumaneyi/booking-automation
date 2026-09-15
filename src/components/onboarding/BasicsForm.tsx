"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingMode } from "@/types/booking";

const MODES: Array<{ mode: BookingMode; title: string; blurb: string }> = [
  {
    mode: "appointment",
    title: "Appointments",
    blurb: "Services with fixed times — salon, clinic, barber, consultant.",
  },
  {
    mode: "resource",
    title: "Rentals",
    blurb: "Bookable items for a period — cars, rooms, equipment.",
  },
  {
    mode: "capacity",
    title: "Group sessions",
    blurb: "Tours, classes and experiences with a number of guests.",
  },
];

const BUSINESS_TYPES = [
  "Barbershop",
  "Hair salon",
  "Beauty salon",
  "Spa",
  "Car rental",
  "Equipment rental",
  "Surf school",
  "Swim school",
  "Tour operator",
  "Boat charter",
  "Restaurant",
  "Clinic",
  "Fitness class",
  "Photography",
];

const TIMEZONES = [
  "Indian/Mauritius",
  "Indian/Reunion",
  "Africa/Johannesburg",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/New_York",
];

/**
 * Minimum business information: name, type, contact, booking mode.
 * Posts to the idempotent basics endpoint — refresh/retry returns the
 * existing business instead of creating a duplicate.
 */
export default function BasicsForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("Indian/Mauritius");
  const [mode, setMode] = useState<BookingMode>("appointment");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-blue disabled:opacity-40";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || name.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding/basics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          businessType: businessType.trim(),
          phone: phone.trim(),
          timezone,
          booking_mode: mode,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: { userMessage?: string };
      } | null;
      if (!response.ok) {
        throw new Error(data?.error?.userMessage ?? "Something went wrong. Please try again.");
      }
      router.push("/onboarding");
      router.refresh();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
        Get started
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        Tell us about your business
      </h1>
      <p className="mt-2 text-ink-soft">
        Just the basics — you&apos;ll choose how to finish setup on the next step.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Business name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            required
            minLength={2}
            autoComplete="organization"
            className={inputClass}
            placeholder="ABC Cuts"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Business type
          <input
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            disabled={busy}
            list="kivo-business-types"
            autoComplete="off"
            className={inputClass}
            placeholder="Barbershop"
          />
          <datalist id="kivo-business-types">
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          WhatsApp number
          <span className="text-xs font-normal text-ink-soft">
            Kivo contacts you here about your setup. Shown to customers on your booking page.
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={inputClass}
            placeholder="+230 …"
          />
        </label>

        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-medium" id="basics-mode-label">
            How do customers book with you?
          </p>
          <div role="group" aria-labelledby="basics-mode-label" className="flex flex-col gap-2.5">
            {MODES.map((option) => (
              <button
                key={option.mode}
                type="button"
                disabled={busy}
                onClick={() => setMode(option.mode)}
                aria-pressed={mode === option.mode}
                className={[
                  "rounded-xl border p-4 text-left transition-all duration-150",
                  mode === option.mode
                    ? "border-blue bg-blue-mist ring-1 ring-blue"
                    : "border-line bg-card hover:border-blue/50",
                ].join(" ")}
              >
                <span className="font-semibold">{option.title}</span>
                <span className="mt-1 block text-sm text-ink-soft">{option.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Timezone
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={busy}
            className={inputClass}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={busy || name.trim().length < 2}
          className="mt-2 min-h-[52px] rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
