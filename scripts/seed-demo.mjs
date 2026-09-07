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

const DEMOS = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Fade Area",
    phone: "+230 5711 1111",
    email: "demo@fadearea.mu",
    timezone: "Indian/Mauritius",
    booking_mode: "appointment",
    slug: "fade-area",
    tagline: "Your neighbourhood barbershop — walk-ins welcome, appointments preferred.",
    description: "Fade Area has been keeping Mauritius sharp since 2019. Our barbers specialise in fades, tapers, and classic cuts — all done with attention to detail and a cold drink in hand. Walk in or book ahead, we'll get you sorted.",
    cover_image_url: "https://images.unsplash.com/photo-1675599193884-38c7a5ceecbc?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    logo_url: null,
    services: [
      { name: "Haircut", duration_minutes: 45, price: 450 },
      { name: "Beard Trim", duration_minutes: 30, price: 250 },
      { name: "Consultation", duration_minutes: 30, price: 0 },
    ],
    resources: [],
    sessions: [],
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Island Surf Co.",
    phone: "+230 5722 2222",
    email: "demo@islandsurf.mu",
    timezone: "Indian/Mauritius",
    booking_mode: "resource",
    slug: "island-surf",
    tagline: "Island life starts here. Boards, bikes, and beach gear by the hour.",
    description: "Whether you're catching your first wave or your fiftieth, Island Surf Co. has the gear and the local knowledge to make it happen. Rent a board, grab a bike, or just swing by for a chat about tomorrow's swell.",
    cover_image_url: "https://images.unsplash.com/photo-1502680390548-bdbac40a9b27?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    logo_url: null,
    services: [{ name: "Daily Board Rental", duration_minutes: 1440, price: 1200 }],
    resources: [
      { name: "Shortboard — 6ft", resource_type: "equipment" },
      { name: "Longboard — 8ft", resource_type: "equipment" },
      { name: "Paddleboard — 10ft", resource_type: "equipment" },
    ],
    sessions: [],
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Blue Lagoon Swim School",
    phone: "+230 5733 3333",
    email: "demo@bluelagoon.mu",
    timezone: "Indian/Mauritius",
    booking_mode: "capacity",
    slug: "blue-lagoon",
    tagline: "Learn to swim with confidence. Classes for all ages and abilities.",
    description: "Blue Lagoon has been teaching Mauritius to swim since 2020. Small groups, patient instructors, and a pool that feels like home. From toddlers to triathletes, everyone starts somewhere — and this is the place.",
    cover_image_url: "https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    logo_url: null,
    services: [
      { name: "Group Swimming Lesson", duration_minutes: 60, price: 350 },
      { name: "Kids Adventure Swim", duration_minutes: 45, price: 280 },
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
    });
    if (error) throw error;
    businessId = demo.id;
    counts.businesses++;
  } else {
    const { error } = await db.from("businesses").update({
      name: demo.name, is_demo: true,
      tagline: demo.tagline, description: demo.description,
      cover_image_url: demo.cover_image_url ?? null, logo_url: demo.logo_url ?? null,
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
      const { error } = await db.from("resources").insert({ business_id: businessId, name: res.name, resource_type: res.resource_type, active: true });
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

console.log(`seed:demo done — new businesses=${counts.businesses} services=${counts.services} resources=${counts.resources} sessions=${counts.sessions}`);
