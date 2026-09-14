/**
 * Kivo demo reset — `npm run reset:demo`
 *
 * Removes visitor-generated bookings + customers from DEMO businesses only,
 * restoring a predictable demo state. Also restores canonical business
 * fields (address, coordinates, theme, etc.) from the shared demo data.
 *
 * MUST only ever touch `is_demo = true` businesses — the business ids are
 * resolved server-side from that flag, never from CLI args or client input.
 * Never exposed as a public API. Requires service-role credentials.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getDemoById } from "./demo-data.mjs";
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
  console.error("reset:demo needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// Resolve demo scope SERVER-SIDE from the explicit flag — nothing else.
const { data: demos, error: demoErr } = await db.from("businesses").select("id, slug").eq("is_demo", true);
if (demoErr) throw demoErr;
const ids = (demos ?? []).map((b) => b.id);
console.log(`demo scope: ${(demos ?? []).map((b) => b.slug).join(", ") || "(none)"}`);
if (ids.length === 0) {
  console.log("reset:demo done — no demo businesses, nothing to remove.");
  process.exit(0);
}

// Bookings first (they reference customers + services with RESTRICT).
const { error: bErr, count: bCount } = await db.from("bookings").delete({ count: "exact" }).in("business_id", ids);
if (bErr) throw bErr;

// Then visitor customers of demo businesses.
const { error: cErr, count: cCount } = await db.from("customers").delete({ count: "exact" }).in("business_id", ids);
if (cErr) throw cErr;

// Restore canonical business fields (address, coordinates, theme, etc.)
let restored = 0;
for (const demo of demos ?? []) {
  const canonical = getDemoById(demo.id);
  if (!canonical) {
    console.warn(`reset:demo — no canonical data for ${demo.slug}, skipping restore`);
    continue;
  }
  const { error: uErr } = await db
    .from("businesses")
    .update({
      name: canonical.name,
      phone: canonical.phone,
      email: canonical.email,
      timezone: canonical.timezone,
      booking_mode: canonical.booking_mode,
      tagline: canonical.tagline,
      description: canonical.description,
      cover_image_url: canonical.cover_image_url,
      logo_url: canonical.logo_url,
      theme_config: canonical.theme_config,
      address: canonical.address,
      latitude: canonical.latitude,
      longitude: canonical.longitude,
    })
    .eq("id", demo.id)
    .eq("is_demo", true); // safety belt: only touch demo businesses
  if (uErr) throw uErr;
  restored++;
}

// Re-apply canonical demo reservations so the dashboards stay alive.
const reservations = await applyDemoReservations(db);

console.log(`reset:demo done — removed bookings=${bCount ?? 0} customers=${cCount ?? 0} restored=${restored} reservations=${reservations} (demo businesses only)`);
