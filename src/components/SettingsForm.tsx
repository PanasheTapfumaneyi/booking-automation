"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import HoursEditor from "@/components/HoursEditor";
import type { BusinessHours } from "@/lib/availability";
import type { BookingMode } from "@/types/booking";

/** Curated fallback when `Intl.supportedValuesOf` is unavailable. */
const FALLBACK_TIMEZONES = [
  "Africa/Abidjan",
  "Africa/Accra",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Atlantic/Canary",
  "Australia/Sydney",
  "Australia/Perth",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Pacific/Auckland",
  "Indian/Mauritius",
  "Indian/Reunion",
];

function supportedTimezones(): string[] {
  if (typeof Intl !== "undefined" && typeof (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf === "function") {
    try {
      return (Intl as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return FALLBACK_TIMEZONES;
    }
  }
  return FALLBACK_TIMEZONES;
}

function isValidTimezone(tz: string): boolean {
  const clean = tz.trim();
  if (!clean) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: clean });
    return true;
  } catch {
    return false;
  }
}

function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export interface SettingsBundle {
  business: {
    id: string;
    name: string;
    phone: string | null;
    timezone: string;
    booking_mode: BookingMode;
    slug: string | null;
    availability: BusinessHours | null;
    tagline: string | null;
    description: string | null;
    cover_image_url: string | null;
    logo_url: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    is_active: boolean;
  };
  services: Array<{ id: string; name: string; duration_minutes: number; price: number; active: boolean; description: string | null }>;
  resources: Array<{ id: string; name: string; resource_type: string; active: boolean }>;
  sessions: Array<{
    id: string;
    service_id: string;
    service_name: string | null;
    start_time: string;
    end_time: string | null;
    capacity: number;
    active: boolean;
    booked: number;
    remaining: number;
  }>;
  notifications: {
    business_notification_phone: string | null;
    customer_notifications_enabled: boolean;
    business_notifications_enabled: boolean;
    whatsapp_enabled: boolean;
  };
  calendar: {
    connected: boolean;
    calendarId: string | null;
    accountEmail: string | null;
    requiresReconnect: boolean;
    checked: boolean;
  };
  businesses: string[];
}

async function requestJson(url: string, body?: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as {
    error?: { userMessage?: string };
  } & Record<string, unknown>;
  if (!response.ok) {
    throw new Error(data?.error?.userMessage ?? "Something went wrong. Please try again.");
  }
  return data;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** "Unsaved changes" hint announced politely when a section is dirty. */
function DirtyHint({ dirty }: { dirty: boolean }) {
  if (!dirty) return null;
  return (
    <p role="status" className="text-xs font-medium text-gold-strong">
      Unsaved changes
    </p>
  );
}

const inputClass =
  "rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-gold disabled:opacity-40";
const buttonClass =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-black disabled:cursor-not-allowed disabled:opacity-40";

/** Owner settings: profile, hours, offering, notifications, integrations. */
export default function SettingsForm({ bundle }: { bundle: SettingsBundle }) {
  const business = bundle.business;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [live, setLive] = useState<SettingsBundle>(bundle);

  const [name, setName] = useState(business.name);
  const [phone, setPhone] = useState(business.phone ?? "");
  const [timezone, setTimezone] = useState(business.timezone);
  const [hours, setHours] = useState<BusinessHours | null>(business.availability);

  const [tagline, setTagline] = useState(business.tagline ?? "");
  const [description, setDescription] = useState(business.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(business.cover_image_url ?? "");
  const [logoUrl, setLogoUrl] = useState(business.logo_url ?? "");
  const [address, setAddress] = useState(business.address ?? "");
  const [latitude, setLatitude] = useState(business.latitude != null ? String(business.latitude) : "");
  const [longitude, setLongitude] = useState(business.longitude != null ? String(business.longitude) : "");

  const [notifyPhone, setNotifyPhone] = useState(bundle.notifications.business_notification_phone ?? "");
  const [customerAlerts, setCustomerAlerts] = useState(bundle.notifications.customer_notifications_enabled);
  const [businessAlerts, setBusinessAlerts] = useState(bundle.notifications.business_notifications_enabled);

  const [newServiceName, setNewServiceName] = useState("");
  const [newDuration, setNewDuration] = useState("45");
  const [newPrice, setNewPrice] = useState("500");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [editResourceName, setEditResourceName] = useState("");
  const [newResourceName, setNewResourceName] = useState("");
  const [newSessionService, setNewSessionService] = useState(bundle.services[0]?.id ?? "");
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionTime, setNewSessionTime] = useState("09:00");
  const [newCapacity, setNewCapacity] = useState("10");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionCapacity, setEditSessionCapacity] = useState("");
  const [editSessionDate, setEditSessionDate] = useState("");
  const [editSessionTime, setEditSessionTime] = useState("");

  const [whatsapp, setWhatsapp] = useState<{ ok: boolean } | null>(null);

  const timezoneOptions = useMemo(() => supportedTimezones(), []);

  const hasUnsavedEdits = editingServiceId !== null || editingResourceId !== null || editingSessionId !== null;
  useEffect(() => {
    if (!hasUnsavedEdits) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedEdits]);

  async function refresh() {
    const data = (await requestJson(`/api/businesses/${business.id}`, undefined, "GET")) as {
      services: SettingsBundle["services"];
      resources: SettingsBundle["resources"];
      sessions: SettingsBundle["sessions"];
      notifications: SettingsBundle["notifications"];
      calendar: SettingsBundle["calendar"];
      business: SettingsBundle["business"];
    };
    setLive((current) => ({ ...current, ...data }));
    setName(data.business.name);
    setPhone(data.business.phone ?? "");
    setTimezone(data.business.timezone);
    setHours(data.business.availability);
    setTagline(data.business.tagline ?? "");
    setDescription(data.business.description ?? "");
    setCoverImageUrl(data.business.cover_image_url ?? "");
    setLogoUrl(data.business.logo_url ?? "");
    setAddress(data.business.address ?? "");
    setLatitude(data.business.latitude != null ? String(data.business.latitude) : "");
    setLongitude(data.business.longitude != null ? String(data.business.longitude) : "");
    setNotifyPhone(data.notifications.business_notification_phone ?? "");
    setCustomerAlerts(data.notifications.customer_notifications_enabled);
    setBusinessAlerts(data.notifications.business_notifications_enabled);
  }

  async function run(key: string, work: () => Promise<unknown>, doneMessage?: string) {
    // Double-submit guard: a second submit (Enter key, double click) while
    // any request is in flight is ignored — buttons are also disabled.
    if (busy !== null) return;
    setBusy(key);
    setError(null);
    setSaved(null);
    try {
      await work();
      await refresh();
      if (doneMessage) setSaved(doneMessage);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  // --- Dirty tracking: Save enables only when the section differs from the
  // last server-confirmed snapshot (`live`). Failed values are preserved in
  // state (never reset on error) and the error stays until the next submit.
  const liveBusiness = live.business;
  const profileDirty =
    name !== liveBusiness.name ||
    phone !== (liveBusiness.phone ?? "") ||
    timezone !== liveBusiness.timezone ||
    tagline !== (liveBusiness.tagline ?? "") ||
    description !== (liveBusiness.description ?? "") ||
    coverImageUrl !== (liveBusiness.cover_image_url ?? "") ||
    logoUrl !== (liveBusiness.logo_url ?? "") ||
    address !== (liveBusiness.address ?? "") ||
    latitude !== (liveBusiness.latitude != null ? String(liveBusiness.latitude) : "") ||
    longitude !== (liveBusiness.longitude != null ? String(liveBusiness.longitude) : "");
  const hoursDirty =
    JSON.stringify(hours ?? null) !== JSON.stringify(liveBusiness.availability ?? null);
  const notificationsDirty =
    notifyPhone !== (live.notifications.business_notification_phone ?? "") ||
    customerAlerts !== live.notifications.customer_notifications_enabled ||
    businessAlerts !== live.notifications.business_notifications_enabled;
  const addServiceDirty =
    newServiceName.trim() !== "" || newDuration !== "45" || newPrice !== "500";
  const addResourceDirty = newResourceName.trim() !== "";
  const addSessionDirty =
    newSessionService !== "" || newSessionDate !== "" || newSessionTime !== "09:00" || newCapacity !== "10";

  function submitHandler(work: () => void) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      work();
    };
  }

  const saveProfile = () => {
    if (!name.trim()) {
      setError("Please enter a business name.");
      return;
    }
    if (!isValidTimezone(timezone)) {
      setError("Please choose a valid IANA timezone (for example Indian/Mauritius).");
      return;
    }
    if (!isValidHttpUrl(coverImageUrl)) {
      setError("Cover image must be an http(s) URL.");
      return;
    }
    if (!isValidHttpUrl(logoUrl)) {
      setError("Logo must be an http(s) URL.");
      return;
    }
    if (tagline.length > 200) {
      setError("Tagline must be 200 characters or fewer.");
      return;
    }
    if (description.length > 2000) {
      setError("Description must be 2,000 characters or fewer.");
      return;
    }
    const lat = latitude !== "" ? Number(latitude) : null;
    const lng = longitude !== "" ? Number(longitude) : null;
    if (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
      setError("Latitude must be between -90 and 90.");
      return;
    }
    if (lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
      setError("Longitude must be between -180 and 180.");
      return;
    }
    run("profile", () =>
      requestJson(`/api/businesses/${business.id}`, {
        name: name.trim(),
        phone,
        timezone,
        tagline,
        description,
        cover_image_url: coverImageUrl,
        logo_url: logoUrl,
        address,
        latitude: lat,
        longitude: lng,
      }, "PATCH"),
      "Profile saved.",
    );
  };

  const saveHours = () =>
    run(
      "hours",
      () => requestJson(`/api/businesses/${business.id}`, { availability: hours }, "PATCH"),
      "Opening hours saved.",
    );

  const addService = () =>
    run("service-add", () =>
      requestJson(`/api/businesses/${business.id}/services`, {
        name: newServiceName,
        duration_minutes: Number(newDuration),
        price: Number(newPrice || 0),
      }).then(() => {
        setNewServiceName("");
      }),
    );

  const toggleService = (serviceId: string, active: boolean) =>
    run(`service-${serviceId}`, () =>
      requestJson(`/api/businesses/${business.id}/services/${serviceId}`, { active }, "PATCH"),
    );

  const saveServiceEdit = (serviceId: string) =>
    run(`service-${serviceId}`, () =>
      requestJson(`/api/businesses/${business.id}/services/${serviceId}`, {
        name: editName,
        duration_minutes: Number(editDuration),
        price: Number(editPrice || 0),
        description: editDescription || null,
      }, "PATCH").then(() => setEditingServiceId(null)),
    );

  const saveResourceEdit = (resourceId: string) =>
    run(`resource-${resourceId}`, () =>
      requestJson(`/api/businesses/${business.id}/resources/${resourceId}`, {
        name: editResourceName,
      }, "PATCH").then(() => setEditingResourceId(null)),
    );

  const addResource = () =>
    run("resource-add", () =>
      requestJson(`/api/businesses/${business.id}/resources`, { name: newResourceName }).then(() => {
        setNewResourceName("");
      }),
    );

  const toggleResource = (resourceId: string, active: boolean) =>
    run(`resource-${resourceId}`, () =>
      requestJson(`/api/businesses/${business.id}/resources/${resourceId}`, { active }, "PATCH"),
    );

  const addSession = () =>
    run("session-add", () => {
      if (!newSessionService || !newSessionDate || !newSessionTime) {
        throw new Error("Please choose a service, date and start time.");
      }
      const service = live.services.find((s) => s.id === newSessionService);
      const start = new Date(`${newSessionDate}T${newSessionTime}:00`);
      const end = new Date(start.getTime() + (service?.duration_minutes ?? 60) * 60_000);
      return requestJson(`/api/businesses/${business.id}/sessions`, {
        service_id: newSessionService,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        capacity: Number(newCapacity),
      });
    });

  const toggleSession = (sessionId: string, active: boolean) =>
    run(`session-${sessionId}`, () =>
      requestJson(`/api/businesses/${business.id}/sessions/${sessionId}`, { active }, "PATCH"),
    );

  const saveSessionEdit = (sessionId: string) =>
    run(`session-${sessionId}`, () => {
      const body: Record<string, unknown> = {};
      if (editSessionCapacity.trim().length > 0) body.capacity = Number(editSessionCapacity);
      if (editSessionDate && editSessionTime) {
        body.start_time = new Date(`${editSessionDate}T${editSessionTime}:00`).toISOString();
      } else if (editSessionDate || editSessionTime) {
        throw new Error("Please provide both a date and a start time, or neither.");
      }
      if (Object.keys(body).length === 0) {
        throw new Error("Nothing to save — change capacity or time first.");
      }
      return requestJson(`/api/businesses/${business.id}/sessions/${sessionId}`, body, "PATCH").then(() => {
        setEditingSessionId(null);
        setEditSessionCapacity("");
        setEditSessionDate("");
        setEditSessionTime("");
      });
    });

  const saveNotifications = () =>
    run("notifications", () =>
      requestJson(`/api/businesses/${business.id}/notifications`, {
        business_notification_phone: notifyPhone.trim().length > 0 ? notifyPhone.trim() : null,
        customer_notifications_enabled: customerAlerts,
        business_notifications_enabled: businessAlerts,
      }),
      "Notification settings saved.",
    );

  const disconnectCalendar = () =>
    run("calendar", () =>
      fetch(`/api/integrations/google-calendar/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business: business.id }),
      }).then(async (response) => {
        if (!response.ok) throw new Error("Couldn't disconnect the calendar. Please try again.");
      }),
    );

  async function checkWhatsapp() {
    setBusy("whatsapp");
    try {
      const response = await fetch("/api/integrations/baileys/status");
      setWhatsapp(response.ok ? { ok: true } : null);
      if (!response.ok) setWhatsapp(null);
      const data = (await response.json().catch(() => null)) as { sessionReady?: boolean } | null;
      setWhatsapp(data && response.ok ? { ok: data.sessionReady === true } : null);
    } catch {
      setWhatsapp(null);
    } finally {
      setBusy(null);
    }
  }

  const mode = live.business.booking_mode;

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <Link href="/dashboard" className="text-sm font-medium text-ink-soft hover:text-ink">
          ‹ Dashboard
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {live.business.name} · {mode === "appointment" ? "Appointments" : mode === "resource" ? "Rentals" : "Group sessions"}
        {live.business.slug && (
          <>
            {" · Booking page: "}
            <Link href={`/book/${live.business.slug}`} className="font-medium text-ink hover:underline">
              /book/{live.business.slug}
            </Link>
          </>
        )}
      </p>

      {error && (
        <div role="alert" className="mb-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" className="mb-6 mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {saved}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <Section title="Business profile">
          <form onSubmit={submitHandler(saveProfile)} className="flex flex-col gap-3">
            <DirtyHint dirty={profileDirty} />
            <label className="flex flex-col gap-1 text-sm font-medium">
              Name
              <input
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy !== null}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy !== null} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Timezone
              <input
                list="kivo-timezone-options"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={busy !== null}
                placeholder="Indian/Mauritius"
                className={inputClass}
              />
              <datalist id="kivo-timezone-options">
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
            </label>
            <p className="text-xs text-ink-soft">Booking type ({mode}) can&apos;t be changed after setup.</p>
            <div>
              <button type="submit" disabled={busy !== null || !profileDirty} className={buttonClass}>
                {busy === "profile" ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        </Section>

        <Section title="Opening hours">
          <form onSubmit={submitHandler(saveHours)} className="flex flex-col gap-3">
            <DirtyHint dirty={hoursDirty} />
            <HoursEditor value={hours} onChange={setHours} disabled={busy !== null} />
            <div className="mt-1">
              <button type="submit" disabled={busy !== null || !hoursDirty} className={buttonClass}>
                {busy === "hours" ? "Saving…" : "Save hours"}
              </button>
            </div>
          </form>
        </Section>

        <Section title="Public page">
          <p className="mb-4 text-sm text-ink-soft">
            Customize how your business appears on <span className="font-medium text-ink">/business/{business.slug ?? "..."}</span>. All fields are optional.
          </p>
          <form onSubmit={submitHandler(saveProfile)} className="flex flex-col gap-3">
            <DirtyHint dirty={profileDirty} />
            <label className="flex flex-col gap-1 text-sm font-medium">
              Tagline
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Simple booking, without the back-and-forth."
                maxLength={200}
                disabled={busy !== null}
                className={inputClass}
              />
              <span className="text-xs text-ink-soft">Shown under your business name. Max 200 characters.</span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              About / Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell customers what makes your business special..."
                rows={4}
                maxLength={2000}
                disabled={busy !== null}
                className={`${inputClass} resize-y`}
              />
              <span className="text-xs text-ink-soft">Plain text. Shown below the hero section. Max 2,000 characters.</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Cover image URL
                <input
                  type="url"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://example.com/hero.jpg"
                  disabled={busy !== null}
                  className={inputClass}
                />
                <span className="text-xs text-ink-soft">Background image for the hero. Must be http(s) URL.</span>
                {coverImageUrl && (
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="mt-1 h-16 w-full rounded-lg object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Logo URL
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  disabled={busy !== null}
                  className={inputClass}
                />
                <span className="text-xs text-ink-soft">Shown above your business name. Must be http(s) URL.</span>
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="mt-1 h-12 w-12 rounded-lg object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Business address
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Royal Road, Quatre Bornes, Mauritius"
                disabled={busy !== null}
                className={inputClass}
              />
              <span className="text-xs text-ink-soft">Shown on your public page with a map. Max 500 characters.</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Latitude
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="-20.2417"
                  disabled={busy !== null}
                  className={inputClass}
                />
                <span className="text-xs text-ink-soft">Optional. Enables embedded map.</span>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Longitude
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="57.4781"
                  disabled={busy !== null}
                  className={inputClass}
                />
                <span className="text-xs text-ink-soft">Optional. Enables embedded map.</span>
              </label>
            </div>
            <div>
              <button type="submit" disabled={busy !== null || !profileDirty} className={buttonClass}>
                {busy === "profile" ? "Saving…" : "Save public page"}
              </button>
            </div>
          </form>
        </Section>

        <Section title={mode === "resource" ? "Rental items" : mode === "capacity" ? "Services & sessions" : "Services"}>
          <div className="flex flex-col gap-2">
            {live.services.map((service) => (
              <div key={service.id} className="rounded-xl border border-line px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className={service.active ? "" : "text-ink-soft line-through"}>
                    {service.name} · {service.duration_minutes} min · Rs{service.price}
                  </span>
                  <span className="flex gap-3">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (editingServiceId === service.id) {
                          setEditingServiceId(null);
                          return;
                        }
                        setEditingServiceId(service.id);
                        setEditName(service.name);
                        setEditDuration(String(service.duration_minutes));
                        setEditPrice(String(service.price));
                        setEditDescription(service.description ?? "");
                      }}
                      className="font-medium text-ink-soft hover:text-ink"
                    >
                      {editingServiceId === service.id ? "Close" : "Edit"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => toggleService(service.id, !service.active)}
                      className="font-medium text-ink-soft hover:text-ink"
                    >
                      {busy === `service-${service.id}` ? "…" : service.active ? "Deactivate" : "Activate"}
                    </button>
                  </span>
                </div>
                {editingServiceId === service.id && (
                  <form
                    onSubmit={submitHandler(() => saveServiceEdit(service.id))}
                    className="mt-2.5 flex flex-col gap-2"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input aria-label="Service name" value={editName} onChange={(e) => setEditName(e.target.value)} disabled={busy !== null} className={`${inputClass} flex-1`} />
                      <input aria-label="Duration in minutes" type="number" min={5} max={1440} step={5} value={editDuration} onChange={(e) => setEditDuration(e.target.value)} disabled={busy !== null} className={`${inputClass} w-24`} />
                      <input aria-label="Price in rupees" type="number" min={0} max={1000000} step="any" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} disabled={busy !== null} className={`${inputClass} w-24`} />
                    </div>
                    <textarea
                      aria-label="Service description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Short description shown on your public page..."
                      rows={2}
                      disabled={busy !== null}
                      className={`${inputClass} resize-y`}
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={busy !== null} className={buttonClass}>
                        {busy === `service-${service.id}` ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => setEditingServiceId(null)}
                        className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-soft hover:text-ink"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={submitHandler(addService)} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <DirtyHint dirty={addServiceDirty} />
            <input
              aria-label={mode === "resource" ? "New service name" : "New service name"}
              placeholder="Service name"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              disabled={busy !== null}
              className={`${inputClass} flex-1`}
            />
            <input
              aria-label="Duration in minutes"
              placeholder="45 min"
              type="number"
              min={5}
              max={1440}
              step={5}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              disabled={busy !== null}
              className={`${inputClass} w-24`}
            />
            <input
              aria-label="Price in rupees"
              placeholder="Rs"
              type="number"
              min={0}
              max={1000000}
              step="any"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              disabled={busy !== null}
              className={`${inputClass} w-24`}
            />
            <button type="submit" disabled={busy !== null} className={buttonClass}>
              {busy === "service-add" ? "…" : "Add"}
            </button>
          </form>


          {mode === "resource" && (
            <>
              <div className="mt-5 flex flex-col gap-2">
                {live.resources.map((resource) => (
                  <div key={resource.id} className="rounded-xl border border-line px-4 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className={resource.active ? "" : "text-ink-soft line-through"}>{resource.name}</span>
                      <span className="flex gap-3">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => {
                            if (editingResourceId === resource.id) {
                              setEditingResourceId(null);
                              return;
                            }
                            setEditingResourceId(resource.id);
                            setEditResourceName(resource.name);
                          }}
                          className="font-medium text-ink-soft hover:text-ink"
                        >
                          {editingResourceId === resource.id ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => toggleResource(resource.id, !resource.active)}
                          className="font-medium text-ink-soft hover:text-ink"
                        >
                          {busy === `resource-${resource.id}` ? "…" : resource.active ? "Deactivate" : "Activate"}
                        </button>
                      </span>
                    </div>
                    {editingResourceId === resource.id && (
                      <form
                        onSubmit={submitHandler(() => saveResourceEdit(resource.id))}
                        className="mt-2.5 flex gap-2"
                      >
                        <input aria-label="Resource name" value={editResourceName} onChange={(e) => setEditResourceName(e.target.value)} disabled={busy !== null} className={`${inputClass} flex-1`} />
                        <button type="submit" disabled={busy !== null} className={buttonClass}>
                          {busy === `resource-${resource.id}` ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => setEditingResourceId(null)}
                          className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-soft hover:text-ink"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={submitHandler(addResource)} className="mt-3 flex gap-2">
                <DirtyHint dirty={addResourceDirty} />
                <input
                  aria-label="New rental item name"
                  placeholder="New rental item"
                  value={newResourceName}
                  onChange={(e) => setNewResourceName(e.target.value)}
                  disabled={busy !== null}
                  className={`${inputClass} flex-1`}
                />
                <button type="submit" disabled={busy !== null} className={buttonClass}>
                  {busy === "resource-add" ? "…" : "Add"}
                </button>
              </form>
            </>
          )}

          {mode === "capacity" && (
            <>
              <div className="mt-5 flex flex-col gap-2">
                {live.sessions.map((session) => (
                  <div key={session.id} className="rounded-xl border border-line px-4 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className={session.active ? "" : "text-ink-soft line-through"}>
                        {session.service_name ?? "Session"} · {new Date(session.start_time).toLocaleString()} · {session.booked}/{session.capacity} booked
                      </span>
                      <span className="flex gap-3">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => {
                            if (editingSessionId === session.id) {
                              setEditingSessionId(null);
                              return;
                            }
                            setEditingSessionId(session.id);
                            setEditSessionCapacity(String(session.capacity));
                            setEditSessionDate("");
                            setEditSessionTime("");
                          }}
                          className="font-medium text-ink-soft hover:text-ink"
                        >
                          {editingSessionId === session.id ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => toggleSession(session.id, !session.active)}
                          className="font-medium text-ink-soft hover:text-ink"
                        >
                          {busy === `session-${session.id}` ? "…" : session.active ? "Deactivate" : "Activate"}
                        </button>
                      </span>
                    </div>
                    {editingSessionId === session.id && (
                      <form
                        onSubmit={submitHandler(() => saveSessionEdit(session.id))}
                        className="mt-2.5 grid grid-cols-2 gap-2"
                      >
                        <input aria-label="Session capacity" value={editSessionCapacity} onChange={(e) => setEditSessionCapacity(e.target.value)} disabled={busy !== null} inputMode="numeric" className={inputClass} placeholder="Guests" />
                        <input aria-label="Session date" type="date" value={editSessionDate} onChange={(e) => setEditSessionDate(e.target.value)} disabled={busy !== null} className={inputClass} />
                        <input aria-label="Session start time" type="time" value={editSessionTime} onChange={(e) => setEditSessionTime(e.target.value)} disabled={busy !== null} className={inputClass} />
                        <div className="flex gap-2">
                          <button type="submit" disabled={busy !== null} className={buttonClass}>
                            {busy === `session-${session.id}` ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => setEditingSessionId(null)}
                            className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-soft hover:text-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={submitHandler(addSession)} className="mt-3">
                <DirtyHint dirty={addSessionDirty} />
                <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Session service"
                  value={newSessionService}
                  onChange={(e) => setNewSessionService(e.target.value)}
                  disabled={busy !== null}
                  className={inputClass}
                >
                  {live.services.filter((s) => s.active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input aria-label="Guests" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} disabled={busy !== null} inputMode="numeric" className={inputClass} placeholder="Guests" />
                <input aria-label="Session date" type="date" value={newSessionDate} onChange={(e) => setNewSessionDate(e.target.value)} disabled={busy !== null} className={inputClass} />
                <input aria-label="Session start time" type="time" value={newSessionTime} onChange={(e) => setNewSessionTime(e.target.value)} disabled={busy !== null} className={inputClass} />
                </div>
                <div className="mt-3">
                  <button type="submit" disabled={busy !== null} className={buttonClass}>
                    {busy === "session-add" ? "…" : "Add session"}
                  </button>
                </div>
              </form>
            </>
          )}
        </Section>

        <Section title="Notifications">
          <form onSubmit={submitHandler(saveNotifications)} className="flex flex-col gap-3 text-sm">
            <DirtyHint dirty={notificationsDirty} />
            <label className="flex flex-col gap-1 font-medium">
              Your WhatsApp number
              <input value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} disabled={busy !== null} className={inputClass} placeholder="+230 …" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={customerAlerts} onChange={(e) => setCustomerAlerts(e.target.checked)} disabled={busy !== null} className="h-4 w-4 accent-gold" />
              Customer WhatsApp confirmations
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={businessAlerts} onChange={(e) => setBusinessAlerts(e.target.checked)} disabled={busy !== null} className="h-4 w-4 accent-gold" />
              Owner WhatsApp alerts
            </label>
            <div>
              <button type="submit" disabled={busy !== null || !notificationsDirty} className={buttonClass}>
                {busy === "notifications" ? "Saving…" : "Save notifications"}
              </button>
            </div>
          </form>
        </Section>

        <Section title="Integrations">
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>
                Google Calendar —{" "}
                {live.calendar.connected
                  ? `connected${live.calendar.accountEmail ? ` as ${live.calendar.accountEmail}` : ""}`
                  : live.calendar.requiresReconnect
                    ? "needs reconnecting"
                    : "not connected"}
              </span>
              {live.calendar.connected || live.calendar.requiresReconnect ? (
                <button type="button" disabled={busy !== null} onClick={disconnectCalendar} className="font-medium text-ink-soft hover:text-ink">
                  {busy === "calendar" ? "…" : "Disconnect"}
                </button>
              ) : (
                <Link
                  href={`/api/integrations/google-calendar/connect?business=${business.id}`}
                  className="font-medium text-ink hover:underline"
                >
                  Connect
                </Link>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>
                WhatsApp notifications —{" "}
                {whatsapp === null ? "tap check to probe the platform service" : whatsapp.ok ? "available" : "service unavailable"}
              </span>
              <button type="button" disabled={busy !== null} onClick={checkWhatsapp} className="font-medium text-ink-soft hover:text-ink">
                {busy === "whatsapp" ? "…" : "Check"}
              </button>
            </div>
            <p className="text-xs text-ink-soft">WhatsApp is a platform service — nothing to scan or configure per business.</p>
          </div>
        </Section>
      </div>
    </div>
  );
}
