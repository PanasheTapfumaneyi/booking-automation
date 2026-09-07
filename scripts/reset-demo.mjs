/**
 * Kivo demo reset — `npm run reset:demo`
 *
 * Removes visitor-generated bookings + customers from DEMO businesses only,
 * restoring a predictable demo state. The demo catalog (businesses,
 * services, resources, sessions) is left intact.
 *
 * MUST only ever touch `is_demo = true` businesses — the business ids are
 * resolved server-side from that flag, never from CLI args or client input.
 * Never exposed as a public API. Requires service-role credentials.
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

console.log(`reset:demo done — removed bookings=${bCount ?? 0} customers=${cCount ?? 0} (demo businesses only)`);
