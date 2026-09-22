"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import HoursEditor from "@/components/HoursEditor";
import MediaField from "@/components/storefront/MediaField";
import ResourcePhotos from "@/components/ResourcePhotos";
import { storefrontApi } from "@/components/storefront/api";
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

/** One-line price recap for a rental row, e.g. "Rs 1,400/day · Rs 8,000/week". */
function resourcePriceSummary(metadata: Record<string, unknown> | null | undefined): string {
  const num = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const daily = num(metadata?.rate);
  if (daily === null) return "No daily rate set";
  const parts = [`Rs ${daily.toLocaleString("en-MU")}/day`];
  const weekly = num(metadata?.weekly_rate);
  if (weekly !== null) parts.push(`Rs ${weekly.toLocaleString("en-MU")}/week`);
  const monthly = num(metadata?.monthly_rate);
  if (monthly !== null) parts.push(`Rs ${monthly.toLocaleString("en-MU")}/month`);
  return parts.join(" · ");
}

const RESOURCE_TYPES = ["vehicle", "equipment", "room", "boat", "generic"];

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
  services: Array<{ id: string; name: string; duration_minutes: number; price: number; active: boolean; description: string | null; image_url: string | null }>;
  resources: Array<{ id: string; name: string; resource_type: string; active: boolean; description: string | null; image_url: string | null; images: string[]; metadata: Record<string, unknown> }>;
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
    <p role="status" className="text-xs font-medium text-blue-strong">
      Unsaved changes
    </p>
  );
}

const inputClass =
  "rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-blue disabled:opacity-40";
const buttonClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-full bg-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40";

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
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [editResourceName, setEditResourceName] = useState("");
  const [editResourceType, setEditResourceType] = useState("generic");
  const [editResourceDescription, setEditResourceDescription] = useState("");
  const [editResourceCover, setEditResourceCover] = useState<string | null>(null);
  const [editResourceExtras, setEditResourceExtras] = useState<string[]>([]);
  const [editDaily, setEditDaily] = useState("");
  const [editWeekly, setEditWeekly] = useState("");
  const [editMonthly, setEditMonthly] = useState("");
  const [editSeats, setEditSeats] = useState("");
  const [editTransmission, setEditTransmission] = useState("");
  const [editFuel, setEditFuel] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [newResourceName, setNewResourceName] = useState("");
  const [newResourceType, setNewResourceType] = useState("vehicle");
  const [newResourceDescription, setNewResourceDescription] = useState("");
  const [newResourceCover, setNewResourceCover] = useState<string | null>(null);
  const [newResourceExtras, setNewResourceExtras] = useState<string[]>([]);
  const [newDaily, setNewDaily] = useState("");
  const [newWeekly, setNewWeekly] = useState("");
  const [newMonthly, setNewMonthly] = useState("");
  const [newSeats, setNewSeats] = useState("5");
  const [newTransmission, setNewTransmission] = useState("Automatic");
  const [newFuel, setNewFuel] = useState("Petrol");
  const [newCategory, setNewCategory] = useState("");
  const [confirmDeleteResourceId, setConfirmDeleteResourceId] = useState<string | null>(null);
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
  const addResourceDirty =
    newResourceName.trim() !== "" ||
    newResourceDescription.trim() !== "" ||
    newResourceCover !== null ||
    newResourceExtras.length > 0 ||
    newDaily.trim() !== "" ||
    newWeekly.trim() !== "" ||
    newMonthly.trim() !== "";
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
    run(`service-${serviceId}`, () => {
      const imageUrl = editImageUrl.trim();
      if (imageUrl && !isValidHttpUrl(imageUrl)) {
        throw new Error("Please enter a valid image URL starting with http:// or https://.");
      }
      const previous = live.services.find((s) => s.id === serviceId)?.image_url ?? null;
      const next = imageUrl || null;
      return requestJson(`/api/businesses/${business.id}/services/${serviceId}`, {
        name: editName,
        duration_minutes: Number(editDuration),
        price: Number(editPrice || 0),
        description: editDescription || null,
        image_url: next,
      }, "PATCH").then(() => {
        // Best-effort cleanup of a replaced/removed storage image.
        // External hotlinks are skipped server-side.
        if (previous && previous !== next) {
          void storefrontApi.deleteMediaUrl(business.id, previous).catch(() => undefined);
        }
        setEditingServiceId(null);
      });
    });

  /** Best-effort removal of storage images no longer referenced. */
  const cleanupResourceImages = (previous: string[], next: string[]) => {
    for (const url of previous) {
      if (!next.includes(url)) {
        void storefrontApi.deleteMediaUrl(business.id, url).catch(() => undefined);
      }
    }
  };

  const previousResourceUrls = (resourceId: string): string[] => {
    const current = live.resources.find((r) => r.id === resourceId);
    if (!current) return [];
    return [current.image_url, ...current.images].filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );
  };

  const saveResourceEdit = (resourceId: string) =>
    run(`resource-${resourceId}`, () => {
      if (editResourceCover && !isValidHttpUrl(editResourceCover)) {
        throw new Error("Please enter a valid cover image URL starting with http:// or https://.");
      }
      const extras = editResourceExtras.filter((u) => u !== editResourceCover);
      return requestJson(`/api/businesses/${business.id}/resources/${resourceId}`, {
        name: editResourceName,
        resource_type: editResourceType || null,
        description: editResourceDescription || null,
        image_url: editResourceCover,
        images: extras,
        daily_rate: editDaily.trim() === "" ? null : Number(editDaily),
        weekly_rate: editWeekly.trim() === "" ? null : Number(editWeekly),
        monthly_rate: editMonthly.trim() === "" ? null : Number(editMonthly),
        seats: editSeats.trim() === "" ? null : Number(editSeats),
        transmission: editTransmission || null,
        fuel: editFuel || null,
        category: editCategory || null,
      }, "PATCH").then(() => {
        cleanupResourceImages(previousResourceUrls(resourceId), [
          ...(editResourceCover ? [editResourceCover] : []),
          ...extras,
        ]);
        setEditingResourceId(null);
      });
    });

  const resetNewResourceForm = () => {
    setNewResourceName("");
    setNewResourceType("vehicle");
    setNewResourceDescription("");
    setNewResourceCover(null);
    setNewResourceExtras([]);
    setNewDaily("");
    setNewWeekly("");
    setNewMonthly("");
    setNewSeats("5");
    setNewTransmission("Automatic");
    setNewFuel("Petrol");
    setNewCategory("");
  };

  const addResource = () =>
    run("resource-add", () => {
      if (newResourceCover && !isValidHttpUrl(newResourceCover)) {
        throw new Error("Please enter a valid cover image URL starting with http:// or https://.");
      }
      const extras = newResourceExtras.filter((u) => u !== newResourceCover);
      return requestJson(`/api/businesses/${business.id}/resources`, {
        name: newResourceName,
        resource_type: newResourceType || null,
        description: newResourceDescription || null,
        image_url: newResourceCover,
        images: extras,
        daily_rate: newDaily.trim() === "" ? null : Number(newDaily),
        weekly_rate: newWeekly.trim() === "" ? null : Number(newWeekly),
        monthly_rate: newMonthly.trim() === "" ? null : Number(newMonthly),
        seats: newSeats.trim() === "" ? null : Number(newSeats),
        transmission: newTransmission || null,
        fuel: newFuel || null,
        category: newCategory || null,
      }).then(() => {
        resetNewResourceForm();
      });
    });

  const toggleResource = (resourceId: string, active: boolean) =>
    run(`resource-${resourceId}`, () =>
      requestJson(`/api/businesses/${business.id}/resources/${resourceId}`, { active }, "PATCH"),
    );

  const deleteResourceItem = (resourceId: string) =>
    run(`resource-${resourceId}`, () =>
      requestJson(`/api/businesses/${business.id}/resources/${resourceId}`, undefined, "DELETE").then(() => {
        cleanupResourceImages(previousResourceUrls(resourceId), []);
        setConfirmDeleteResourceId(null);
        setEditingResourceId(null);
      }),
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
      }, "PATCH").catch((err: unknown) => {
        // The shared fetch helper falls back to a generic message when the
        // server gives no user-facing one (network failure, unexpected
        // status). Scope it to this section — server validation messages
        // (e.g. unusable phone number) pass through untouched.
        if (err instanceof Error && err.message === "Something went wrong. Please try again.") {
          throw new Error("We couldn't save your notification settings. Please try again.");
        }
        throw err;
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
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {live.business.name} · {mode === "appointment" ? "Appointments" : mode === "resource" ? "Rentals" : "Group sessions"}
            {live.business.slug && (
              <>
                {" · Booking page: "}
                <Link href={`/book/${live.business.slug}`} className="font-medium text-blue-strong hover:underline">
                  /book/{live.business.slug}
                </Link>
              </>
            )}
          </p>
        </div>
        <Link
          href={`/dashboard?business=${live.business.id}`}
          className="shrink-0 text-sm font-medium text-ink-soft hover:text-ink"
        >
          ‹ Dashboard
        </Link>
      </div>

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
          {mode === "resource" && (
            <p className="mb-3 text-sm text-ink-soft">
              Bookings run on your default rental service — manage everything your
              customers see right here, per vehicle.
            </p>
          )}
          {mode !== "resource" && (
          <>
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
                        setEditImageUrl(service.image_url ?? "");
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
                    <MediaField
                      label="Service photo"
                      hint="Shown on your booking page. Upload an image or paste a URL below."
                      value={editImageUrl.trim() || null}
                      kind="service"
                      aspect="wide"
                      businessId={business.id}
                      disabled={busy !== null}
                      onChange={(url) => setEditImageUrl(url ?? "")}
                    />
                    <input
                      aria-label="Service image URL"
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      placeholder="...or paste an image URL (https://...)"
                      disabled={busy !== null}
                      inputMode="url"
                      className={inputClass}
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
                aria-label="New service name"
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
          </>
          )}


          {mode === "resource" && (
            <>
              <div className="mt-5 flex flex-col gap-2">
                {live.resources.map((resource) => (
              <div key={resource.id} className="rounded-xl border border-line px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    {resource.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resource.image_url}
                        alt=""
                        aria-hidden="true"
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <span className="min-w-0">
                      <span className={`block truncate ${resource.active ? "" : "text-ink-soft line-through"}`}>
                        {resource.name}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {resourcePriceSummary(resource.metadata)}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (editingResourceId === resource.id) {
                          setEditingResourceId(null);
                          return;
                        }
                        const meta = resource.metadata ?? {};
                        setEditingResourceId(resource.id);
                        setEditResourceName(resource.name);
                        setEditResourceType(resource.resource_type);
                        setEditResourceDescription(resource.description ?? "");
                        setEditResourceCover(resource.image_url);
                        setEditResourceExtras(resource.images ?? []);
                        setEditDaily(meta.rate !== undefined && meta.rate !== null ? String(meta.rate) : "");
                        setEditWeekly(meta.weekly_rate !== undefined && meta.weekly_rate !== null ? String(meta.weekly_rate) : "");
                        setEditMonthly(meta.monthly_rate !== undefined && meta.monthly_rate !== null ? String(meta.monthly_rate) : "");
                        setEditSeats(meta.seats !== undefined && meta.seats !== null ? String(meta.seats) : "");
                        setEditTransmission(typeof meta.transmission === "string" ? meta.transmission : "");
                        setEditFuel(typeof meta.fuel === "string" ? meta.fuel : "");
                        setEditCategory(typeof meta.category === "string" ? meta.category : "");
                        setConfirmDeleteResourceId(null);
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
                        className="mt-2.5 flex flex-col gap-2"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input aria-label="Rental item name" value={editResourceName} onChange={(e) => setEditResourceName(e.target.value)} disabled={busy !== null} className={`${inputClass} flex-1`} />
                          <select
                            aria-label="Rental item type"
                            value={RESOURCE_TYPES.includes(editResourceType) ? editResourceType : "generic"}
                            onChange={(e) => setEditResourceType(e.target.value)}
                            disabled={busy !== null}
                            className={`${inputClass} sm:w-36`}
                          >
                            {RESOURCE_TYPES.map((t) => (
                              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          aria-label="Rental item description"
                          value={editResourceDescription}
                          onChange={(e) => setEditResourceDescription(e.target.value)}
                          placeholder="Short description shown on your booking page..."
                          rows={2}
                          disabled={busy !== null}
                          className={`${inputClass} resize-y`}
                        />
                        <fieldset className="rounded-xl border border-line p-3">
                          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                            Rental rates (Rs)
                          </legend>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="flex flex-col gap-1 text-xs font-medium">
                              Per day *
                              <input aria-label="Daily rate in rupees" type="number" min={0} max={10000000} step="any" value={editDaily} onChange={(e) => setEditDaily(e.target.value)} disabled={busy !== null} placeholder="1400" className={inputClass} />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium">
                              Per week
                              <input aria-label="Weekly rate in rupees" type="number" min={0} max={10000000} step="any" value={editWeekly} onChange={(e) => setEditWeekly(e.target.value)} disabled={busy !== null} placeholder="8000" className={inputClass} />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium">
                              Per month
                              <input aria-label="Monthly rate in rupees" type="number" min={0} max={10000000} step="any" value={editMonthly} onChange={(e) => setEditMonthly(e.target.value)} disabled={busy !== null} placeholder="30000" className={inputClass} />
                            </label>
                          </div>
                          <p className="mt-1.5 text-xs text-ink-soft">
                            A 10-day stay at Rs 1,400/day + Rs 8,000/week bills as 1 week + 3 days.
                          </p>
                        </fieldset>
                        <fieldset className="rounded-xl border border-line p-3">
                          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                            Details
                          </legend>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <label className="flex flex-col gap-1 text-xs font-medium">
                              Seats
                              <input aria-label="Seats" type="number" min={1} max={100} step={1} value={editSeats} onChange={(e) => setEditSeats(e.target.value)} disabled={busy !== null} placeholder="5" className={inputClass} />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium">
                              Transmission
                              <input aria-label="Transmission" value={editTransmission} onChange={(e) => setEditTransmission(e.target.value)} disabled={busy !== null} placeholder="Automatic" className={inputClass} />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium">
                              Fuel
                              <input aria-label="Fuel" value={editFuel} onChange={(e) => setEditFuel(e.target.value)} disabled={busy !== null} placeholder="Petrol" className={inputClass} />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium">
                              Category
                              <input aria-label="Category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} disabled={busy !== null} placeholder="Compact" className={inputClass} />
                            </label>
                          </div>
                        </fieldset>
                        <ResourcePhotos
                          businessId={business.id}
                          cover={editResourceCover}
                          extras={editResourceExtras}
                          disabled={busy !== null}
                          onCoverChange={setEditResourceCover}
                          onExtrasChange={setEditResourceExtras}
                        />
                        <div className="flex flex-wrap gap-2">
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
                          {confirmDeleteResourceId === resource.id ? (
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => deleteResourceItem(resource.id)}
                              className="rounded-full border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                            >
                              {busy === `resource-${resource.id}` ? "Deleting…" : "Confirm delete"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => setConfirmDeleteResourceId(resource.id)}
                              className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-soft hover:text-red-700"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        {confirmDeleteResourceId === resource.id && (
                          <p className="text-xs text-ink-soft">
                            Past bookings keep working, but lose this item&apos;s name. Prefer deactivation when in doubt.
                          </p>
                        )}
                      </form>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={submitHandler(addResource)} className="mt-3 flex flex-col gap-2 rounded-xl border border-dashed border-line p-4">
                <DirtyHint dirty={addResourceDirty} />
                <p className="text-sm font-semibold">Add a rental item</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label="New rental item name"
                    placeholder="e.g. Toyota Corolla"
                    value={newResourceName}
                    onChange={(e) => setNewResourceName(e.target.value)}
                    disabled={busy !== null}
                    className={`${inputClass} flex-1`}
                  />
                  <select
                    aria-label="New rental item type"
                    value={newResourceType}
                    onChange={(e) => setNewResourceType(e.target.value)}
                    disabled={busy !== null}
                    className={`${inputClass} sm:w-36`}
                  >
                    {RESOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  aria-label="New rental item description"
                  value={newResourceDescription}
                  onChange={(e) => setNewResourceDescription(e.target.value)}
                  placeholder="Short description shown on your booking page..."
                  rows={2}
                  disabled={busy !== null}
                  className={`${inputClass} resize-y`}
                />
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Per day (Rs) *
                    <input aria-label="New daily rate in rupees" type="number" min={0} max={10000000} step="any" value={newDaily} onChange={(e) => setNewDaily(e.target.value)} disabled={busy !== null} placeholder="1400" className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Per week (Rs)
                    <input aria-label="New weekly rate in rupees" type="number" min={0} max={10000000} step="any" value={newWeekly} onChange={(e) => setNewWeekly(e.target.value)} disabled={busy !== null} placeholder="8000" className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Per month (Rs)
                    <input aria-label="New monthly rate in rupees" type="number" min={0} max={10000000} step="any" value={newMonthly} onChange={(e) => setNewMonthly(e.target.value)} disabled={busy !== null} placeholder="30000" className={inputClass} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Seats
                    <input aria-label="New seats" type="number" min={1} max={100} step={1} value={newSeats} onChange={(e) => setNewSeats(e.target.value)} disabled={busy !== null} placeholder="5" className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Transmission
                    <input aria-label="New transmission" value={newTransmission} onChange={(e) => setNewTransmission(e.target.value)} disabled={busy !== null} placeholder="Automatic" className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Fuel
                    <input aria-label="New fuel" value={newFuel} onChange={(e) => setNewFuel(e.target.value)} disabled={busy !== null} placeholder="Petrol" className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Category
                    <input aria-label="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} disabled={busy !== null} placeholder="Compact" className={inputClass} />
                  </label>
                </div>
                <ResourcePhotos
                  businessId={business.id}
                  cover={newResourceCover}
                  extras={newResourceExtras}
                  disabled={busy !== null}
                  onCoverChange={setNewResourceCover}
                  onExtrasChange={setNewResourceExtras}
                />
                <div>
                  <button type="submit" disabled={busy !== null} className={buttonClass}>
                    {busy === "resource-add" ? "Adding…" : "Add rental item"}
                  </button>
                </div>
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
              <input value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} disabled={busy !== null} className={inputClass} placeholder="+230 5xxx xxxx" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={customerAlerts} onChange={(e) => setCustomerAlerts(e.target.checked)} disabled={busy !== null} className="h-5 w-5 accent-[#15547D]" />
              Customer WhatsApp confirmations
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={businessAlerts} onChange={(e) => setBusinessAlerts(e.target.checked)} disabled={busy !== null} className="h-5 w-5 accent-[#15547D]" />
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
