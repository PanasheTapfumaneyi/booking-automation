# Real Business Onboarding (production tenants)

Generic, repeatable process for bringing a REAL business onto Kivo.
First executed for **Watpo Hair Studio**; reuse as-is for customer #2, #3, …

Principles:

- A real business is a **normal production row**: `is_demo = false`,
  `is_active = false` until launch, same tenant model as every future customer.
- **Never invent data.** Every field below comes from the business owner.
  Missing information blocks its step — do not use placeholders.
- **Never use demo tooling** (`seed:demo`, `reset:demo`) for real tenants.
- All owner access flows through the existing membership model
  (`business_members`, role `owner`); no Watpo-specific code or pages exist.

Canonical public URLs (existing architecture, no new routes):

- Public page: `/business/<slug>` (e.g. `/business/watpo-hair-studio`)
- Booking flow: `/book/<slug>` (e.g. `/book/watpo-hair-studio`)

---

## 0. Prerequisites

- [ ] Supabase migrations applied through `0014_business_activation.sql`
      (`is_active` column must exist before provisioning).
- [ ] Production Supabase project (NOT the demo/dev database).
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
      (provisioning script only; never commit this file).
- [ ] App deployed or running (`npm run dev` for local verification).

## 1. Collect business information

Gather from the owner — write down exactly what they say:

| Field | Example (Watpo) | Status |
|---|---|---|
| Business name | Watpo Hair Studio | ✅ known |
| Slug | `watpo-hair-studio` | ✅ chosen |
| Timezone | `Indian/Mauritius` | ✅ known |
| Address | Royal Road, Flic-en-Flac, Mauritius | ✅ known |
| Booking mode | `appointment` | ✅ chosen |
| Public phone | — | ❌ required |
| Public email | — | ❌ required |
| Description | — | ❌ required |
| Owner name | — | ❌ required |
| Owner login email | — | ❌ required |
| Services (name, duration, price) | — | ❌ required |
| Opening hours (per weekday) | — | ❌ required |

Do NOT proceed to provisioning without at minimum: name, owner login email,
booking mode. Everything else can be completed in Settings later, but the
business stays **inactive** until all of it is verified.

Booking rules (per-business interval, minimum notice, advance window,
cancellation cutoff) are **not yet a Kivo feature** — the platform uses
`BOOKING_WINDOW_DAYS` and the fixed slot grid for every tenant. Record the
owner's wishes and apply them manually at launch if possible; otherwise log
as a feature request. Do not promise per-business rules.

## 2. Provision business (inactive)

The owner needs a login account first. Create it via Supabase Auth
(Dashboard → Authentication → Add user, or the app's `/signup`), then copy
the user's UUID.

```bash
npm run provision:business -- \
  --name "Watpo Hair Studio" \
  --owner <supabase-auth-user-uuid> \
  --slug watpo-hair-studio \
  --timezone Indian/Mauritius \
  --mode appointment \
  --address "Royal Road, Flic-en-Flac, Mauritius"
```

Note: if `npm run` drops the `--flags` on your platform, invoke node
directly (identical behavior): `node scripts/provision-business.mjs --name
...`. The script prints an error naming the missing flag when arguments
are lost in transit — never proceed past that error.

What the script does (service-role, inserts only):

1. Verifies the owner Auth user exists (aborts otherwise — nothing written).
2. Verifies the slug is free (aborts on conflict — never auto-suffixes).
3. Inserts the business with `is_demo = false`, `is_active = false`.
4. Inserts the `owner` membership for the Auth user.
5. Creates the default notification-settings row.
6. Cleans up (deletes the business) if steps 4–5 fail.

Verify: the script prints the business id, slug, and `active: false`.

Add `--active` ONLY if the business is fully configured and ready for the
public immediately. Default (no flag) is inactive — the safe choice.

## 3. Create/invite owner

Covered by step 2 (`--owner`). If the owner has no account yet:

1. Owner signs up at `/signup` (or is created in Supabase Auth).
2. Re-run the provision command with their user UUID, or — if the business
   already exists — insert the membership directly in Supabase
   (`business_members`: `business_id`, `user_id`, `role = 'owner'`).

The owner must see exactly one business after login (their own). Verify in
Supabase: `select * from business_members where user_id = '<uuid>'`.

## 4. Configure services

Owner logs in → `/settings` → Services section. For each service the owner
confirmed: name, duration (minutes), price (Rs), description, active.

Alternatively the owner can do this themselves after a walkthrough. Either
way, verify each row in Supabase belongs to the right `business_id`.

## 5. Configure opening hours

`/settings` → Opening hours. Enter the owner's real weekly schedule
(per-day open/close or closed). Days left unset fall back to platform
defaults (Mon–Fri 09:00–18:00, Sat 09:00–16:00, Sun closed) — confirm with
the owner that the fallback matches reality before launch.

## 6. Configure booking rules

See the note in step 1: per-business rules are not yet configurable.
Confirm the platform defaults with the owner and record any gap.

## 7. Verify public page (still hidden)

While inactive, confirm the page is **hidden**:

- `/business/watpo-hair-studio` → 404
- `/book/watpo-hair-studio` → 404
- `GET /api/public/businesses/watpo-hair-studio` → 404

If any of these resolve, stop — the business was provisioned active by
mistake. Deactivate via `PATCH /api/businesses/<id> { "is_active": false }`
as the owner, then continue.

## 8. Owner logs in

Owner visits the app, logs in with their own credentials, and lands on
`/dashboard` showing **Watpo Hair Studio** (and nothing else). Confirm:

- No other tenant is visible (no business switcher, or only Watpo).
- `/onboarding` redirects to `/dashboard` (membership exists).
- A user with no business still lands on `/onboarding` (unchanged).

## 9. Owner connects Google Calendar

Expected initial state in `/settings` → Integrations: **Not connected**.

1. Owner clicks **Connect Google Calendar**.
2. Google OAuth consent → authorize Kivo.
3. Callback stores the connection scoped to Watpo's `business_id`.
4. Dashboard shows **Connected** + the Google account email.

Verify in Supabase (`calendar_connections`): exactly one `active = true`
row with `business_id = <watpo-id>`. Tokens are encrypted at rest — never
ask for or store the owner's Google password.

## 10. Configure notifications

`/settings` → Notifications (all business-scoped, verified by tests):

- Customer WhatsApp confirmations: on/off per owner preference.
- Business (owner) WhatsApp alerts: set `business_notification_phone` to the
  owner's real WhatsApp number (E.164, e.g. `+2305...`).
- `whatsapp_enabled` master switch.

Confirm no other tenant's settings were touched (each settings row is keyed
by `business_id`).

## 11. Create controlled test booking

With the owner's permission, create ONE clearly-marked test booking via the
public flow (`/book/watpo-hair-studio` will 404 while inactive — temporarily
activate, book, then deactivate; or book after step 18 and treat step 17
accordingly). Use a real name/number the owner recognizes, e.g.
`Test — <owner name>`.

## 12. Verify dashboard

The test booking appears under `/dashboard` → today/upcoming for Watpo.
Confirm counts, service name, time, and customer details.

## 13. Verify Google Calendar

The test booking created a real event on the owner's connected calendar
(status `synced`). Confirm title/time match.

## 14. Verify notifications

If WhatsApp/Baileys is configured: owner received the business alert and the
test customer number received the confirmation. Both messages reference
Watpo only.

## 15. Test reschedule

Reschedule the test booking via its manage link. Confirm dashboard,
calendar event, and notifications all update.

## 16. Test cancellation

Cancel the test booking via its manage link. Confirm dashboard status,
calendar event removal, and notifications.

## 17. Remove/mark test data

- Cancelled test bookings remain in the database (status `cancelled`) —
  they never block availability. Leave them, or delete the test booking +
  test customer rows directly in Supabase if the owner prefers a clean book.
- NEVER run `npm run reset:demo` for this (demo-scoped, but irrelevant and
  risky context-switching near production data).

## 18. Activate business

Final pre-flight:

- [ ] Services, prices, durations confirmed by owner
- [ ] Opening hours confirmed by owner
- [ ] Public page content (tagline, description, cover image) reviewed
- [ ] Google Calendar connected
- [ ] Notifications configured
- [ ] Test booking lifecycle verified (book → reschedule → cancel)
- [ ] Test data cleaned per step 17

Then, as the owner (or admin via API):

```bash
curl -X PATCH <app>/api/businesses/<watpo-id> \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <owner session cookie>' \
  -d '{ "is_active": true }'
```

Verify public launch:

- `/business/watpo-hair-studio` renders Watpo (no demo banner, no fake
  reviews — the page shows only database content).
- `/book/watpo-hair-studio` starts the real booking flow.
- A fresh customer booking behaves as a **production** action
  (notifications + calendar active, no demo suppression).

---

## Reference: Watpo Hair Studio (customer #1)

Known (safe to use):

- Name: Watpo Hair Studio · slug: `watpo-hair-studio`
- Timezone: `Indian/Mauritius` · mode: `appointment`
- Address: Royal Road, Flic-en-Flac, Mauritius
- Facebook (context only, not source of truth):
  https://www.facebook.com/watpohairstudio/

Still required from the owner (do NOT invent):

1. Owner name
2. Owner login email (Supabase Auth account)
3. Public business phone
4. Public business email
5. Business description / tagline
6. Services (each: name, duration in minutes, price in Rs)
7. Opening hours (each weekday: open/close or closed)
8. Owner WhatsApp number for business alerts
9. Owner's Google account (connected by the owner via OAuth — never collected)
10. Booking-rule preferences (notice window, cancellation cutoff — recorded;
    per-business rules not yet supported, see step 6)
