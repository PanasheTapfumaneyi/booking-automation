/**
 * Kivo production provisioning — `npm run provision:business -- <flags>`
 *
 * Creates ONE real (non-demo) business + its owner membership + default
 * notification settings. Admin-only: requires service-role credentials and is
 * never exposed as a public API. Complements the self-service onboarding
 * (`POST /api/businesses`), which always creates active businesses; this
 * script can provision INACTIVE businesses for pre-launch configuration.
 *
 * Required:
 *   --name "Watpo Hair Studio"   Business display name (2–80 chars)
 *   --owner <auth-user-uuid>      Existing Supabase Auth user id of the owner
 *
 * Optional:
 *   --slug watpo-hair-studio     Exact public slug (lowercase, numbers, hyphens).
 *                                Defaults to a slugified name. Errors when taken
 *                                (never auto-suffixes — slugs are public URLs).
 *   --timezone Indian/Mauritius  IANA timezone (validated)
 *   --mode appointment           appointment | resource | capacity
 *   --phone "+230 ..."           Public phone (max 30 chars)
 *   --email "hello@..."          Public business email (validated format)
 *   --address "Royal Road, ..."  Public address (max 500 chars)
 *   --description "..."          Public "about" text (max 2000 chars, plain text)
 *   --active                     Provision ACTIVE (public immediately).
 *                                Default is INACTIVE (hidden from /business,
 *                                /book and the public catalog until activated).
 *
 * Examples:
 *   node scripts/provision-business.mjs --name "Watpo Hair Studio" --owner <uuid> --slug watpo-hair-studio --address "Royal Road, Flic-en-Flac, Mauritius"
 *   node scripts/provision-business.mjs --name "Watpo Hair Studio" --owner <uuid> --slug watpo-hair-studio --active
 *
 * Safety:
 *   - inserts ONLY (never updates/deletes existing businesses)
 *   - always sets is_demo = false explicitly
 *   - verifies the owner Auth user exists before writing anything
 *   - removes the business again if membership/settings setup fails
 *   - never touches demo rows (no slug/id-based demo logic in this script)
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

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "active") {
      out.active = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      console.error(`provision:business: --${key} needs a value`);
      process.exit(2);
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(name) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "business";
}

function fail(message) {
  console.error(`provision:business: ${message}`);
  process.exit(2);
}

const args = parseArgs(process.argv.slice(2));

// ---- Validate inputs (mirrors src/lib/server/businesses.ts rules) ----
const name = (args.name ?? "").trim();
if (name.length < 2 || name.length > 80) fail("--name is required (2–80 characters).");

const ownerId = (args.owner ?? "").trim();
if (!ownerId) fail("--owner <supabase-auth-user-uuid> is required.");

const rawSlug = args.slug !== undefined ? String(args.slug).trim().toLowerCase().slice(0, 60) : slugify(name);
if (!SLUG_RE.test(rawSlug)) fail(`--slug "${args.slug}" is invalid (lowercase letters, numbers, single hyphens).`);
const slug = rawSlug;

const timezone = (args.timezone ?? "Indian/Mauritius").trim();
try {
  new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
} catch {
  fail(`--timezone "${timezone}" isn't recognized.`);
}

const mode = (args.mode ?? "appointment").trim();
if (mode !== "appointment" && mode !== "resource" && mode !== "capacity") {
  fail('--mode must be appointment, resource, or capacity.');
}

const phone = (args.phone ?? "").trim();
if (phone.length > 30) fail("--phone looks too long (max 30 characters).");

const email = (args.email ?? "").trim();
if (email.length > 0 && (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
  fail(`--email "${email}" is not a valid email address.`);
}

const address = (args.address ?? "").trim();
if (address.length > 500) fail("--address is too long (max 500 characters).");

const description = (args.description ?? "").trim();
if (description.length > 2000) fail("--description is too long (max 2000 characters).");

const isActive = args.active === true;

const env = { ...process.env, ...loadEnv() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("provision:business needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// ---- Pre-flight checks (no writes yet) ----
const { data: owner, error: ownerErr } = await db.auth.admin.getUserById(ownerId);
if (ownerErr || !owner?.user) {
  fail(`owner Auth user not found: ${ownerId} (create the login account first, then re-run).`);
}

const { data: slugTaken, error: slugErr } = await db
  .from("businesses")
  .select("id, is_demo")
  .eq("slug", slug)
  .maybeSingle();
if (slugErr) throw slugErr;
if (slugTaken) {
  fail(`slug "${slug}" is already taken. Choose another --slug.`);
}

// ---- Provision (with cleanup on partial failure) ----
const { data: created, error: createError } = await db
  .from("businesses")
  .insert({
    name,
    phone: phone.length > 0 ? phone : null,
    email: email.length > 0 ? email : null,
    timezone,
    booking_mode: mode,
    slug,
    address: address.length > 0 ? address : null,
    description: description.length > 0 ? description : null,
    is_demo: false,
    is_active: isActive,
  })
  .select("id, slug")
  .single();
if (createError || !created) {
  console.error(createError ?? "insert returned no row");
  process.exit(1);
}
const businessId = created.id;

try {
  const { error: memberError } = await db.from("business_members").insert({
    business_id: businessId,
    user_id: ownerId,
    role: "owner",
  });
  if (memberError) throw memberError;

  const { error: settingsError } = await db.from("business_notification_settings").upsert(
    {
      business_id: businessId,
      customer_notifications_enabled: true,
      business_notifications_enabled: true,
      whatsapp_enabled: true,
      business_notification_phone: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" },
  );
  if (settingsError) throw settingsError;
} catch (err) {
  await db.from("businesses").delete().eq("id", businessId);
  console.error("provision:business failed during setup — business row removed again.");
  console.error(err?.message ?? err);
  process.exit(1);
}

console.log("provision:business done");
console.log(`  business : ${name} (${businessId})`);
console.log(`  slug     : ${slug}`);
console.log(`  mode     : ${mode} · timezone ${timezone}`);
console.log(`  owner    : ${owner.user.email ?? ownerId}`);
console.log(`  demo     : false · active: ${isActive}`);
console.log(`  public   : /business/${slug} and /book/${slug}${isActive ? "" : " (hidden until activated)"}`);
if (!isActive) {
  console.log("  next     : configure services/hours in /settings, then activate with");
  console.log(`             PATCH /api/businesses/${businessId} { "is_active": true }`);
}
