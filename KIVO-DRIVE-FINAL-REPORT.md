# Kivo Drive — Car Rental Demo Tenant (Final Report)

**Date:** 14 September 2026 · **Status:** Delivered — all gates green
**App:** `booking-automation` (Next.js 16.3.4 / Turbopack) · **Live DB:** `xmlcrngiexvtbljqugdn.supabase.co`
**Base URL for the recording:** `http://localhost:3000`

---

## 1. Objective and outcome

Ship a polished, walkthrough-ready **car-rental demo tenant — Kivo Drive** — inside the
existing Kivo multi-tenant booking platform. The tenant uses the platform's generic
**resource mode** (the same mode barbers use for chairs) upgraded with a real rental UX:
multi-day date/return search, a visual fleet with per-vehicle photos and specs, every
vehicle priced per day from metadata, and vehicle-aware calendar, ICS and notifications.

The engine is **fully generic**: any business whose resources all carry a `metadata.rate`
automatically gets the rental experience — the demo is Kivo Drive, but the capability is
product, not a one-off. No production business was touched, no migration was required, and
no totals are fabricated.

**Outcome:** 410 tests passing (40 files), TypeScript clean, lint 0 errors, production
build succeeds, and the live database is seeded with Kivo Drive plus 7 realistic
reservations that demonstrably block availability.

---

## 2. Demo tenant spec (Kivo Drive)

| Field | Value |
|---|---|
| Name | Kivo Drive |
| Slug | `kivo-drive` |
| UUID | `10000000-0000-4000-8000-000000000004` |
| Mode | `resource` (generic — no rental-specific columns) |
| Timezone | `Indian/Mauritius` |
| Location | Quay Street, Port Louis, Mauritius |
| Contact | `+230 5744 4444` · `demo@kivodrive.mu` |
| `is_demo` | `true` (calendars/WhatsApp writes suppressed; see §8) |
| Theme | Li, automobile identity — `#1B2A33` / accent `#C19A5B` |

**The fleet** (one service, "Car Rental", Rs 1,500 fallback price; five vehicles all
automatic, 5 seats, petrol except where noted):

| Vehicle | Category | Rate/day | Notes |
|---|---|---|---|
| Toyota Vitz | Compact | Rs 1,400 | AC, Bluetooth, reverse camera |
| Suzuki Swift | Compact | Rs 1,600 | AC, Apple CarPlay |
| Nissan Note | Family | Rs 1,750 | spacious boot |
| Hyundai Creta | SUV | Rs 2,500 | AC, sunroof |
| Toyota Hilux | Pickup | Rs 3,000 | Diesel, 4WD, towing hook |

Rate + specs live in `resources.metadata` (JSONB). Total = `rentalDays × rate`.

---

## 3. Architecture — the rental engine

```
BookingFlow (dates → fleet → details → confirmation)
        │  apiGetAvailability(rangeStart/rangeEnd)
        ▼
/api/availability ──► availability-service.getAvailability ──► strategy: resource
                                                                    │
                     resourceIntervalAvailability(business, service, startIso, endIso)
                        │ fetchResourceBlocks (business-scoped, blocking statuses only)
                        ▼ overlap check per vehicle → { resource, available, metadata }
        │
customer submits { serviceId, resourceId, startTime, endTime }
        ▼
booking-service.createBooking ──► assertResourceFree (re-checks overlap + SQL constraint)
        │ computeResourceTotal (days × rate) → displayTotal
        ├► syncAfterCreate(resourceName, displayTotal)   (real tenant only)
        └► dispatchBookingEvent(resourceName, displayTotal) (real tenant only)
```

- **Pure pricing lib** `src/lib/resource-pricing.ts` (client-safe): `readUnitRate`,
  `hasUnitRate`, `rentalDays` (ceil of 24 h blocks), `computeResourceTotal`
  (falls back to the service price when no rate), `formatMauritianRupees`.
- **Generic gating** — `isUnitRatedCollection` (all resources rated) decides the UX.
  Island Surf (no rates) keeps the barber-style flow, byte-identical.
- **Self-exclusion** on reschedule is derived server-side (`excludeBookingId`) so a
  customer can move their own rental without a false conflict.

---

## 4. Data model and constraints — no migration

Reuses `0002`'s existing schema exactly. Verified in code and live:

- `resources.metadata jsonb default '{}'` — carries `rate`, `category`,
  `transmission`, `seats`, `fuel`, `luggage`, `features`, `image_url`.
- `bookings_resource_no_overlap` — partial unique constraint
  (`tstzrange(&&)`, statuses `confirmed`/`rescheduled`, `resource_id` not null):
  **conflict rejection happens in the database**, not just the app.
- `bookings_no_overlap` — business-wide constraint, **scoped `resource_id IS NULL`**,
  so two different vehicles can be rented over the same days (per-resource blocking).
- Only `confirmed`/`rescheduled` block (`BLOCKING_BOOKING_STATUSES`); `cancelled`,
  `completed`, `no_show` never block (kept in sync with the SQL partial predicates).
- `bookings.manage_token` (unique, required) keys the customer manage + calendar links.

**Back-to-back is allowed** (return 10:00 on the 10th, next pickup 10:00 on the 10th or
later); **surrounding overlaps are blocked**.

---

## 5. Feature inventory

**Customer UX — `BookingFlow` (rental step machine)**
- Steps `dates → fleet → details → confirmation` (barber flow untouched).
- Dates step: native date + time fields, min = today, "Return must be after pick-up"
  validation, "Check availability".
- Fleet step: vehicle cards with photo, category, specs, **"Available / Not available"**
  badge, rate/day and `days × rate` live total; routing to details only when available.
- Details → Confirmation summary (multi-day line e.g. `Oct 14 · 10:00 → Oct 16 · 10:00`,
  real business name, `Total: Rs 2,800`), manage + calendar links, "Book another" reset.

**Business page — `/business/kivo-drive`**
- New "The fleet" grid for unit-rated collections (photo, category, specs, `Rs X/day`,
  "Rent this car" → booking deep-link). Non-rated collections keep the old cards.
- Kivo reviews, hours (open all days), WhatsApp CTA, map.

**Business dashboard**
- Bookings list already shows `Car Rental · Toyota Vitz`; the admin select now pulls
  `resource.metadata`, so list/detail show the **computed rental total** (`Total: Rs 2,800`)
  — same math the customer sees, never a fabricate.

**Calendar / ICS**
- Google event summary `Toyota Vitz - Ayesha Ramdin`; description gains `Item:` and
  `Price: Rs 2,800`. ICS summary `Toyota Vitz - Ayesha Ramdin` with multi-day
  DTSTART/DTEND. Appointment output remains byte-identical (regression-tested).

**Notifications** `templates.ts`
- Six message templates now include `service (item)` and `Total: XX` via
  `itemLabel(ctx)` / `totalLine(ctx)`; business name always resolved, never hardcoded;
  customer messages carry the `/manage` link, business messages never carry tokens.

**Demo content tooling** — `scripts/seed-demo.mjs`, `reset-demo.mjs`,
**`scripts/demo-reservations.mjs`** (new, idempotent):
- Seeded live: Kivo Drive business + service + 5 vehicles, plus **7 reservations**
  (Kivo: Toyota Vitz/Ayesha Ramdin confirmed 8–10 Oct; Hyundai Creta/Kevin Belcourt
  confirmed 10–12 Oct; Suzuki Swift/Marie Zephyr completed 3–4 Sep;
  Fade Area: 2 appointments; Blue Lagoon: 2 capacity bookings).
- `reset:demo` restores all demo state on demand (verified live).

---

## 6. Test coverage — 410 tests, 40 files

New suites this milestone (39 tests):

| Suite | Tests | Covers |
|---|---|---|
| `src/lib/resource-pricing.test.ts` | 11 | rate reading, day math (ceil), totals, fallback, formatting |
| `src/lib/server/strategies/resource.test.ts` | 15 | per-vehicle interval conflicts + payload shape |
| `src/app/api/availability/route-interval.test.ts` | 6 | both-or-neither, inverted, unparseable, forwarding |
| `src/lib/server/booking-service.test.ts` | 7 | rental create: rpc args, sync/notification payloads, fallback, pre-write conflict |

**The 14 requested rental scenarios — and where each is proven:**

| # | Scenario | Test |
|---|---|---|
| 1 | Vehicle occupied for the requested period | `resource.test` → "matches the query interval" |
| 2 | Rejected when request starts inside a stay | `resource.test` → "starts inside" |
| 3 | Rejected when request ends inside a stay | `resource.test` → "ends inside" |
| 4 | Rejected when an existing stay surrounds request | `resource.test` → "surrounds" |
| 5 | Request before a stay — fine | `resource.test` → "entirely before" |
| 6 | Request after a stay — fine | `resource.test` → "entirely after" |
| 7 | Back-to-back (return = next pickup) — fine | `resource.test` → "back-to-back" |
| 8 | Cancelled booking never blocks | `resource.test` → "cancelled, completed or no_show" |
| 9 | Different vehicle, same dates — fine | `resource.test` → "different vehicle" |
| 10 | Reschedule excludes own booking | `resource.test` → "excludes a self reservation" |
| 11 | Prices: Vitz 2 days = Rs 2,800; Creta 4 days = Rs 10,000 | `resource-pricing.test` totals |
| 12 | Customer summary shows day×rate total | `booking-service.test` → `displayTotal: "Rs 2,800"` |
| 13 | Interval API validates both-or-neither + ordering | `route-interval.test` |
| 14 | Create re-checks conflicts before any write | `booking-service.test` → "rejects a conflict" |

Existing suites stayed green (templates, Google events/ICS bytes, notifications, hours,
demo-reset updated to 4 demo businesses; hours dates now computed relative to "today").

---

## 7. Verification — gates + live data

- `npm test` → **410 passed / 40 files**
- `npx tsc --noEmit` → clean
- `npm run lint` → **0 errors** (6 pre-existing warnings, none in new code)
- `npm run build` → compiles clean (20 static pages)
- Live seed (`npm run seed:demo`) →
  `new businesses=1 services=1 resources=5 reservations=7`
- Live reset (`npm run reset:demo`) → `removed bookings=10 customers=10 →
  restored=4 reservations=7` (demo scope only; restores clean state on repeat)
- Runtime spot-checks against the fresh dev server:
  - `GET /api/public/businesses/kivo-drive` → full fleet with images + metadata
  - Interval 14–16 Oct → all 5 vehicles `available:true`
  - Interval 8–10 Oct → **Toyota Vitz `false`, Hyundai Creta `false`** (real live
    reservations from seed) — overlap protection proven against the actual DB
  - `/business/kivo-drive`, `/book/kivo-drive`, `/demo/dashboard/kivo-drive` → 200
- Dev server restarted on `http://localhost:3000` (stale bundle cleared).

---

## 8. Security and safety

- **Demo scope is global and generic** (`is_demo` gate): demo businesses **skip** calendar
  sync and WhatsApp dispatch (`demo-safety.test.ts`); `/demo/*` and `/demo/dashboard/*`
  resolve only for `is_demo=true` slugs and mask customer identity (first name +
  `•••• ••56` phone). Production businesses are never reachable through demo routes.
- **No fabrication**: prices come from one pure function used end-to-end; admin and
  customer sides match.
- **No migration and no service-role change** — resource metadata was already exposed and
  safe to read; the admin select now reads it (less, not more, privilege).
- **Capability discipline**: public availability rejects `excludeBookingId`; reschedule
  exclusion always derives from an authorized context; `manage_token` is never in admin
  selects; notification templates never leak tokens to staff.
- **Failure isolation** (unchanged): calendar/notification failures never break a booking.

*(Known, intentionally unchanged:* the standalone manage page header defaults to the base
demo business name — a pre-existing cosmetic quirk, out of rental scope; `/book/[slug]`
searchParams prefill of dates remains a future nicety.)

---

## 9. Recording walkthrough (click-by-click, ~5 minutes)

Start on a fresh dev server (`npm run dev` → `http://localhost:3000`).

1. **Home** → click "Try the demo" → **`/demo`** — chooser shows four cards, **Kivo Drive
   first**. Click it.
2. **`/business/kivo-drive`** — hero (cover photo, tagline, Port Louis, WhatsApp button);
   scroll to **"The fleet"** — five photo cards with category, specs and `Rs X/day`
   (Vitz Rs 1,400 → Hilux Rs 3,000). Click **"Rent this car"** on the Toyota Vitz.
3. **`/book/kivo-drive`** — lands on the **Dates** step with "Car Rental" pre-selected.
   Pick **Pickup Thu 8 Oct · 10:00 → Return Sat 10 Oct · 10:00 → Check availability**.
4. Fleet step shows **Toyota Vitz "Not available"** and **Hyundai Creta "Not available"**
   (live reservations — proof of overlap protection); Swift, Note, Hilux available.
5. Change to **Wed 14 Oct 10:00 → Fri 16 Oct 10:00 → Check availability** — all five
   available. Pick **Toyota Vitz** → card shows *2 days × Rs 1,400 = Rs 2,800*.
6. **Details** — name (e.g. Sachin Hurry), phone, email → **Confirm**.
7. **Confirmation** — *Car Rental — Toyota Vitz*, `Oct 14 · 10:00 → Oct 16 · 10:00`,
   **Total Rs 2,800**, business name Kivo Drive; **Manage booking** + **Calendar (.ics)**
   links.
8. **Manage** (`/manage/…`) — details; **Reschedule** to a conflicting window shows the
   vehicle as unavailable (self-exclusion works); **Cancel** frees it (per-vehicle, live).
9. **Calendar link** → downloads `.ics`: `SUMMARY:Toyota Vitz - Sachin Hurry` with the
   2-day DTSTART/DTEND.
10. **Business side** (no login needed, safe demo) → **`/demo/dashboard/kivo-drive`** —
    upcoming rentals (Vitz, Creta), masked customer names/phones. Login page owners see
    the same bookings with `Car Rental · Toyota Vitz` and `Total: Rs 2,800`.

> Re-seed anytime: `npm run reset:demo` restores businesses, customers and all 7
> reservations idempotently. In production (non-demo) the same rental booking would also
> push the Google Calendar event and the WhatsApp confirmations shown on-screen.