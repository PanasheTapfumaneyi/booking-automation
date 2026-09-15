"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HoursEditor from "@/components/HoursEditor";
import type { BusinessHours } from "@/lib/availability";
import type { BookingMode } from "@/types/booking";

type Step = "basics" | "offering" | "hours" | "notifications" | "integrations";

const STEP_ORDER: Step[] = ["basics", "offering", "hours", "notifications", "integrations"];
const STEP_LABELS: Record<Step, string> = {
  basics: "Your business",
  offering: "What you offer",
  hours: "Opening hours",
  notifications: "Notifications",
  integrations: "Calendar",
};

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

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as {
    error?: { userMessage?: string };
    business?: { id: string; slug: string };
  } | null;
  if (!response.ok) {
    throw new Error(data?.error?.userMessage ?? "Something went wrong. Please try again.");
  }
  return data;
}

async function patchJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as {
    error?: { userMessage?: string };
  } | null;
  if (!response.ok) {
    throw new Error(data?.error?.userMessage ?? "Something went wrong. Please try again.");
  }
}

/** First-run setup: business → offering → hours → notifications → calendar. */
export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basics");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("Indian/Mauritius");
  const [mode, setMode] = useState<BookingMode>("appointment");
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [serviceName, setServiceName] = useState("");
  const [duration, setDuration] = useState("45");
  const [price, setPrice] = useState("500");
  const [resourceName, setResourceName] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("09:00");
  const [capacity, setCapacity] = useState("10");
  const [offeringDone, setOfferingDone] = useState(false);

  const [hours, setHours] = useState<BusinessHours | null>(null);
  const [notifyPhone, setNotifyPhone] = useState("");
  const [calendar, setCalendar] = useState<{
    connected: boolean;
    accountEmail: string | null;
    requiresReconnect: boolean;
  } | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);

  async function run<T>(work: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await work();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleBasics() {
    const created = await run(() =>
      postJson("/api/businesses", { name, phone, timezone, booking_mode: mode }),
    );
    if (created?.business) {
      setBusinessId(created.business.id);
      setStep("offering");
    }
  }

  async function handleOffering() {
    if (!businessId) return;
    const done = await run(async () => {
      if (mode === "appointment") {
        await postJson(`/api/businesses/${businessId}/services`, {
          name: serviceName,
          duration_minutes: Number(duration),
          price: Number(price || 0),
        });
      } else if (mode === "resource") {
        const service = (await postJson(`/api/businesses/${businessId}/services`, {
          name: `${serviceName || "Booking"} service`,
          duration_minutes: 60,
          price: Number(price || 0),
        })) as { service?: { id: string } } | null;
        void service;
        await postJson(`/api/businesses/${businessId}/resources`, {
          name: resourceName,
        });
      } else {
        const created = (await postJson(`/api/businesses/${businessId}/services`, {
          name: serviceName,
          duration_minutes: Number(duration),
          price: Number(price || 0),
        })) as { service?: { id: string } } | null;
        if (!created?.service?.id || !sessionDate || !sessionTime) {
          throw new Error("Please pick a session date, start time and capacity.");
        }
        const start = new Date(`${sessionDate}T${sessionTime}:00`);
        const end = new Date(start.getTime() + Number(duration) * 60_000);
        await postJson(`/api/businesses/${businessId}/sessions`, {
          service_id: created.service.id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          capacity: Number(capacity),
        });
      }
    });
    if (done !== null) {
      setOfferingDone(true);
      setStep("hours");
    }
  }

  async function handleHours() {
    if (!businessId) return;
    const done = await run(() =>
      patchJson(`/api/businesses/${businessId}`, { availability: hours }),
    );
    if (done !== null) setStep("notifications");
  }

  async function handleNotifications() {
    if (!businessId) return;
    const done = await run(() =>
      patchJson(`/api/businesses/${businessId}/notifications`, {
        business_notification_phone: notifyPhone.trim().length > 0 ? notifyPhone.trim() : null,
      }),
    );
    if (done !== null) {
      setStep("integrations");
      const status = await run(async () => {
        const response = await fetch(
          `/api/integrations/google-calendar/status?business=${businessId}`,
        );
        if (!response.ok) return null;
        return (await response.json()) as {
          connected: boolean;
          accountEmail: string | null;
          requiresReconnect: boolean;
        };
      });
      if (status) setCalendar(status);
    }
  }

  const inputClass =
    "rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-blue disabled:opacity-40";

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-8">
      <nav aria-label="Setup progress" className="mb-8">
        <ol className="flex items-center gap-2 text-xs font-medium">
          {STEP_ORDER.map((item, index) => (
            <li key={item} className="flex flex-1 items-center gap-2">
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                  step === item
                    ? "border-blue bg-blue text-white"
                    : index < stepIndex
                      ? "border-blue bg-blue-mist text-blue-strong"
                      : "border-line bg-card text-ink-soft",
                ].join(" ")}
              >
                {index < stepIndex ? "✓" : index + 1}
              </span>
              <span className="hidden sm:inline text-ink-soft">{STEP_LABELS[item]}</span>
              {index < STEP_ORDER.length - 1 && <span className="h-px flex-1 bg-line" />}
            </li>
          ))}
        </ol>
      </nav>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {step === "basics" && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Tell us about your business</h1>
          <div className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Business name
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} className={inputClass} placeholder="Fade District" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Phone <span className="text-xs font-normal text-ink-soft">Shown to customers on your booking page.</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} className={inputClass} placeholder="+230 …" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Timezone
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={busy} className={inputClass} placeholder="Indian/Mauritius" />
            </label>
            <div className="mt-2 flex flex-col gap-2.5">
              <p className="text-sm font-medium">How do customers book with you?</p>
              {MODES.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  disabled={busy}
                  onClick={() => setMode(option.mode)}
                  aria-pressed={mode === option.mode}
                  className={[
                    "rounded-xl border p-4 text-left transition-all",
                    mode === option.mode ? "border-blue bg-blue-mist ring-1 ring-blue" : "border-line bg-card hover:border-blue/50",
                  ].join(" ")}
                >
                  <span className="font-semibold">{option.title}</span>
                  <span className="mt-1 block text-sm text-ink-soft">{option.blurb}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || name.trim().length < 2}
              onClick={handleBasics}
              className="mt-2 rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Creating…" : "Continue"}
            </button>
          </div>
        </section>
      )}

      {step === "offering" && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "appointment" && "Add your first service"}
            {mode === "resource" && "Add your first rental item"}
            {mode === "capacity" && "Add your first service and session"}
          </h1>
          <div className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {mode === "resource" ? "Item name" : "Service name"}
              <input
                value={mode === "resource" ? resourceName : serviceName}
                onChange={(e) =>
                  mode === "resource" ? setResourceName(e.target.value) : setServiceName(e.target.value)
                }
                disabled={busy}
                className={inputClass}
                placeholder={mode === "appointment" ? "Haircut" : mode === "resource" ? "Toyota Corolla" : "Lagoon trip"}
              />
            </label>
            {mode !== "resource" && (
              <>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Duration (minutes)
                  <input value={duration} onChange={(e) => setDuration(e.target.value)} disabled={busy} inputMode="numeric" className={inputClass} />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Price (Rs)
                  <input value={price} onChange={(e) => setPrice(e.target.value)} disabled={busy} inputMode="decimal" className={inputClass} />
                </label>
              </>
            )}
            {mode === "resource" && (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Booking price (Rs) <span className="text-xs font-normal text-ink-soft">Charged per rental.</span>
                <input value={price} onChange={(e) => setPrice(e.target.value)} disabled={busy} inputMode="decimal" className={inputClass} />
              </label>
            )}
            {mode === "capacity" && (
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  First session date
                  <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} disabled={busy} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Start time
                  <input type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} disabled={busy} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Guests
                  <input value={capacity} onChange={(e) => setCapacity(e.target.value)} disabled={busy} inputMode="numeric" className={inputClass} />
                </label>
              </div>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleOffering}
              className="mt-2 rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Saving…" : offeringDone ? "Saved — continue" : "Continue"}
            </button>
          </div>
        </section>
      )}

      {step === "hours" && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">When are you open?</h1>
          <p className="mt-1.5 text-ink-soft">Customers can only book inside these hours.</p>
          <div className="mt-6">
            <HoursEditor value={hours} onChange={setHours} disabled={busy} />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleHours}
            className="mt-6 w-full rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </section>
      )}

      {step === "notifications" && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Where should booking alerts go?</h1>
          <p className="mt-1.5 text-ink-soft">
            Customers always get WhatsApp confirmations. Add your own number to be notified too.
          </p>
          <div className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Your WhatsApp number <span className="text-xs font-normal text-ink-soft">Optional — leave empty to skip owner alerts.</span>
              <input value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} disabled={busy} className={inputClass} placeholder="+230 …" />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={handleNotifications}
              className="mt-2 rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Saving…" : "Continue"}
            </button>
          </div>
        </section>
      )}

      {step === "integrations" && (
        <section className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Connect your calendar</h1>
          <p className="mt-1.5 text-ink-soft">
            {calendar?.connected
              ? `Connected${calendar.accountEmail ? ` as ${calendar.accountEmail}` : ""}. New bookings appear on your Google Calendar.`
              : "Link Google Calendar so bookings block your real availability. You can also do this later in settings."}
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {!calendar?.connected && businessId && (
              <Link
                href={`/api/integrations/google-calendar/connect?business=${businessId}`}
                className="rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong"
              >
                Connect Google Calendar
              </Link>
            )}
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-full border border-line bg-card px-6 py-3.5 text-base font-medium hover:text-ink"
            >
              {calendar?.connected ? "Finish — go to dashboard" : "Skip for now"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
