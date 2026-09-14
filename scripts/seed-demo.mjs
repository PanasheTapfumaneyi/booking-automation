/**
 * Kivo demo seed — `npm run seed:demo`
 *
 * Creates/refreshes the three demo businesses (appointment, resource,
 * capacity) and their catalogs. Explicit, idempotent, demo-only:
 *
 * - upserts businesses by slug (sets is_demo = true, keeps deterministic ids)
 * - inserts missing services / resources / sessions only (never duplicates)
 * - NEVER touches rows belonging to non-demo businesses
 * - safe to rerun at any time
 *
 * Requires server credentials in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * NOTE: supabase/migrations/0009_demo_businesses.sql remains the historical
 * record for environments where it already applied. Going forward, this
 * script is the supported way to seed demo data (schema lives in
 * migrations; demo content lives here).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { DEMO_BUSINESSES } from "./demo-data.mjs";
import { applyDemoReservations } from "./demo-reservations.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const out = {};
  for (const file of [".env.local", ".env"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(m[1] in out)) out[m[1]] = v;
    }
  }
  return out;
}

const env = { ...process.env, ...loadEnv() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("seed:demo needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// Demo catalog data — services, resources, sessions that seed-demo manages.
// Business-level canonical values come from demo-data.mjs (shared with reset).
const DEMO_CATALOGS = [
  {
    id: "10000000-0000-4000-8000-000000000004",
    services: [
      { name: "Car Rental", duration_minutes: 1440, price: 1500, image_url: null, description: "Self-drive car rental by the day. All Kivo Drive vehicles come with full insurance and 24/7 roadside assistance." },
    ],
    resources: [
      { name: "Toyota Vitz", resource_type: "vehicle", image_url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?fm=jpg&q=80&w=900&auto=format&fit=crop", metadata: { rate: 1400, category: "Compact", transmission: "Automatic", seats: 5, fuel: "Petrol", luggage: "2 bags", features: ["AC", "Bluetooth", "Reverse camera"] } },
      { name: "Suzuki Swift", resource_type: "vehicle", image_url: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?fm=jpg&q=80&w=900&auto=format&fit=crop", metadata: { rate: 1600, category: "Compact", transmission: "Automatic", seats: 5, fuel: "Petrol", luggage: "2 bags", features: ["AC", "Apple CarPlay", "Reverse camera"] } },
      { name: "Nissan Note", resource_type: "vehicle", image_url: "https://images.unsplash.com/photo-1555215695-3004980ad54e?fm=jpg&q=80&w=900&auto=format&fit=crop", metadata: { rate: 1750, category: "Family", transmission: "Automatic", seats: 5, fuel: "Petrol", luggage: "3 bags", features: ["AC", "Spacious boot", "Bluetooth"] } },
      { name: "Hyundai Creta", resource_type: "vehicle", image_url: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?fm=jpg&q=80&w=900&auto=format&fit=crop", metadata: { rate: 2500, category: "SUV", transmission: "Automatic", seats: 5, fuel: "Petrol", luggage: "4 bags", features: ["AC", "Sunroof", "Apple CarPlay", "Reverse camera"] } },
      { name: "Toyota Hilux", resource_type: "vehicle", image_url: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?fm=jpg&q=80&w=900&auto=format&fit=crop", metadata: { rate: 3000, category: "Pickup", transmission: "Automatic", seats: 5, fuel: "Diesel", luggage: "4 bags", features: ["4WD", "AC", "Towing hook", "Bluetooth"] } },
    ],
    sessions: [],
  },
  {
    id: "10000000-0000-4000-8000-000000000001",
    services: [
      { name: "Haircut", duration_minutes: 45, price: 450, image_url: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?fm=jpg&q=80&w=800&auto=format&fit=crop", description: "Precision scissor cut and fade, finished to your style." },
      { name: "Beard Trim", duration_minutes: 30, price: 250, image_url: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?fm=jpg&q=80&w=800&auto=format&fit=crop", description: "Shape, line-up and tidy-up using a straight razor." },
      { name: "Consultation", duration_minutes: 30, price: 0, image_url: null, description: "Free consultation to discuss your ideal look." },
    ],
    resources: [],
    sessions: [],
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    services: [{ name: "Daily Board Rental", duration_minutes: 1440, price: 1200, image_url: null, description: "Full-day access to any available board. Includes wax and leash." }],
    resources: [
      { name: "Shortboard — 6ft", resource_type: "equipment", image_url: "https://images.unsplash.com/photo-1502680390548-bdbac40a9b27?fm=jpg&q=80&w=800&auto=format&fit=crop" },
      { name: "Longboard — 8ft", resource_type: "equipment", image_url: "https://images.unsplash.com/photo-1455729552457-5c322b382024?fm=jpg&q=80&w=800&auto=format&fit=crop" },
      { name: "Paddleboard — 10ft", resource_type: "equipment", image_url: "https://images.unsplash.com/photo-1564429238961-bf8f8be819cf?fm=jpg&q=80&w=800&auto=format&fit=crop" },
    ],
    sessions: [],
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    services: [
      { name: "Group Swimming Lesson", duration_minutes: 60, price: 350, image_url: "https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?fm=jpg&q=80&w=800&auto=format&fit=crop", description: "Small-group lesson for all skill levels. Max 10 per class." },
      { name: "Kids Adventure Swim", duration_minutes: 45, price: 280, image_url: "https://images.unsplash.com/photo-1519315901367-f34ff9154487?fm=jpg&q=80&w=800&auto=format&fit=crop", description: "Fun, supervised swim session for children aged 5–12." },
    ],
    resources: [],
    sessions: [
      { service: "Group Swimming Lesson", start: "2026-10-01T08:00:00+04:00", end: "2026-10-01T09:00:00+04:00", capacity: 10 },
      { service: "Group Swimming Lesson", start: "2026-10-01T10:00:00+04:00", end: "2026-10-01T11:00:00+04:00", capacity: 8 },
      { service: "Group Swimming Lesson", start: "2026-10-02T08:00:00+04:00", end: "2026-10-02T09:00:00+04:00", capacity: 10 },
      { service: "Kids Adventure Swim", start: "2026-10-03T09:00:00+04:00", end: "2026-10-03T09:45:00+04:00", capacity: 6 },
    ],
  },
];

// Merge shared business definitions with catalog data
const DEMOS = DEMO_BUSINESSES.map((biz) => {
  const catalog = DEMO_CATALOGS.find((c) => c.id === biz.id);
  return { ...biz, ...catalog };
});

async function ensureService(businessId, svc) {
  const { data } = await db.from("services").select("id").eq("business_id", businessId).eq("name", svc.name).maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await db
    .from("services")
    .insert({ business_id: businessId, name: svc.name, duration_minutes: svc.duration_minutes, price: svc.price, active: true })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

let counts = { businesses: 0, services: 0, resources: 0, sessions: 0 };

for (const demo of DEMOS) {
  // Upsert business by slug; always lands is_demo = true + deterministic id.
  const { data: existing } = await db.from("businesses").select("id").eq("slug", demo.slug).maybeSingle();
  let businessId = existing?.id;
  if (businessId && businessId !== demo.id) {
    // Broken row from an interrupted run: delete it (cascades wipe partials).
    const { error } = await db.from("businesses").delete().eq("id", businessId);
    if (error) throw error;
    businessId = null;
  }
  if (!businessId) {
    const { error } = await db.from("businesses").insert({
      id: demo.id, name: demo.name, phone: demo.phone, email: demo.email,
      timezone: demo.timezone, booking_mode: demo.booking_mode, slug: demo.slug, is_demo: true,
      tagline: demo.tagline, description: demo.description,
      cover_image_url: demo.cover_image_url ?? null, logo_url: demo.logo_url ?? null,
      theme_config: demo.theme_config ?? null,
      address: demo.address ?? null, latitude: demo.latitude ?? null, longitude: demo.longitude ?? null,
    });
    if (error) throw error;
    businessId = demo.id;
    counts.businesses++;
  } else {
    const { error } = await db.from("businesses").update({
      name: demo.name, is_demo: true,
      tagline: demo.tagline, description: demo.description,
      cover_image_url: demo.cover_image_url ?? null, logo_url: demo.logo_url ?? null,
      theme_config: demo.theme_config ?? null,
      address: demo.address ?? null, latitude: demo.latitude ?? null, longitude: demo.longitude ?? null,
    }).eq("id", businessId);
    if (error) throw error;
  }

  const serviceIds = {};
  for (const svc of demo.services) {
    const before = (await db.from("services").select("id").eq("business_id", businessId)).data?.length ?? 0;
    serviceIds[svc.name] = await ensureService(businessId, svc);
    const after = (await db.from("services").select("id").eq("business_id", businessId)).data?.length ?? 0;
    if (after > before) counts.services++;
  }

  for (const res of demo.resources) {
    const { data } = await db.from("resources").select("id").eq("business_id", businessId).eq("name", res.name).maybeSingle();
    if (!data) {
      const { error } = await db.from("resources").insert({ business_id: businessId, name: res.name, resource_type: res.resource_type, active: true, metadata: res.metadata ?? {} });
      if (error) throw error;
      counts.resources++;
    }
  }

  for (const sess of demo.sessions) {
    const { data } = await db
      .from("booking_sessions").select("id").eq("business_id", businessId).eq("start_time", sess.start).maybeSingle();
    if (!data) {
      const { error } = await db.from("booking_sessions").insert({
        business_id: businessId, service_id: serviceIds[sess.service],
        start_time: sess.start, end_time: sess.end, capacity: sess.capacity, active: true,
      });
      if (error) throw error;
      counts.sessions++;
    }
  }

  console.log(`ok: ${demo.name} (${demo.slug})`);
}

// Update service images and descriptions
for (const demo of DEMOS) {
  const { data: biz } = await db.from("businesses").select("id").eq("slug", demo.slug).maybeSingle();
  if (!biz) continue;
  for (const svc of demo.services) {
    await db.from("services").update({ image_url: svc.image_url ?? null, description: svc.description ?? null }).eq("business_id", biz.id).eq("name", svc.name);
  }
  for (const res of demo.resources) {
    await db.from("resources").update({ image_url: res.image_url ?? null, metadata: res.metadata ?? {} }).eq("business_id", biz.id).eq("name", res.name);
  }
}

console.log(`seed:demo done — new businesses=${counts.businesses} services=${counts.services} resources=${counts.resources} sessions=${counts.sessions}`);

// Create canonical demo reservations (idempotent).
const reservations = await applyDemoReservations(db);
console.log(`seed:demo done — new reservations=${reservations}`);
