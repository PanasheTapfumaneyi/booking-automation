# Demo Environment

## Overview

Kivo includes a demo environment with 3 pre-configured businesses covering all booking modes. Visitors can book, manage, and reschedule without affecting real businesses or sending real notifications.

## Demo Businesses

| Business | Mode | Slug | Services |
|----------|------|------|----------|
| **Fade Area** | Appointment | `/book/fade-area` | Haircut, Beard Trim, Consultation |
| **Island Surf Co.** | Resource | `/book/island-surf` | Daily Board Rental (3 boards) |
| **Blue Lagoon Swim School** | Capacity | `/book/blue-lagoon` | Group Swimming Lesson, Kids Adventure Swim |

## Demo Chooser

Visit `/demo` to see all three demo options with descriptions.

## Demo Identification

Demo businesses carry an explicit `businesses.is_demo` boolean
(migration `0010_demo_flag.sql`, default `false`, `NOT NULL`).

- Server code resolves demo state via `isDemoBusiness(row)` in
  `src/lib/server/demo.ts` — literal `is_demo === true` only.
- Never trusted from client input; guards receive service-role rows.
- The old UUID-prefix heuristic is gone.

## Seed Command

```bash
npm run seed:demo
```

Explicit idempotent script (`scripts/seed-demo.mjs`): upserts the three
demo businesses by slug (always `is_demo = true`, deterministic ids),
inserts missing catalog rows only, never touches non-demo rows, safe to
rerun. Repairs broken rows left by interrupted runs.

Historical note: `supabase/migrations/0009_demo_businesses.sql` remains the
migration-history record for environments where it already applied. Going
forward, schema lives in migrations and demo content lives in the seed
script — do not add new demo data to migrations.

## Reset Command

```bash
npm run reset:demo
```

Removes visitor-generated bookings + customers from `is_demo = true`
businesses only (scope resolved server-side from the flag). Catalog is
left intact. Requires service-role credentials; never a public API.

Manual equivalent (scoped the same way):

```sql
-- Remove demo bookings
DELETE FROM bookings WHERE business_id IN (
  SELECT id FROM businesses WHERE is_demo = true
);

-- Remove demo customers
DELETE FROM customers WHERE business_id IN (
  SELECT id FROM businesses WHERE is_demo = true
);
```

## Demo Safety Model

### WhatsApp Notifications

- **Demo businesses**: All WhatsApp sends are suppressed
- Detection: Business IDs starting with `10000000-` are treated as demo
- No real messages are sent to visitor phone numbers
- Production businesses: Unchanged behavior

### Google Calendar

- **Demo businesses**: Calendar sync is skipped (returns `not_connected`)
- No real calendar events are created or modified
- Production businesses: Unchanged behavior

### Database

- Demo businesses have deterministic UUIDs (`10000000-0000-4000-8000-00000000000X`)
- Demo bookings use real tables and real booking logic
- Demo data is mixed with production data (same database)
- No automatic reset mechanism (manual cleanup if needed)

### Mutations Allowed

Visitors to demo booking pages can:
- Browse services, resources, and sessions
- Create bookings (real database records)
- View bookings via manage link
- Reschedule appointment/resource bookings
- Cancel bookings

Visitors **cannot**:
- Modify business settings
- Send real notifications
- Trigger real calendar events

Visitors **can** additionally inspect a read-only demo dashboard
(`/demo/dashboard/[slug]`) — navigation and viewing only, no mutations.

## Differences from Production

| Aspect | Demo | Production |
|--------|------|------------|
| WhatsApp sends | Suppressed | Active (if configured) |
| Google Calendar | Skipped | Active (if connected) |
| Database records | Real | Real |
| Booking logic | Full | Full |
| Dashboard access | Read-only public demo (`/demo/dashboard/[slug]`) | Authenticated (`/dashboard`) |

## Resetting Demo Data (manual fallback)

Prefer `npm run reset:demo`. Manual equivalent:

```sql
-- Remove demo bookings
DELETE FROM bookings WHERE business_id IN (
  SELECT id FROM businesses WHERE is_demo = true
);

-- Remove demo customers
DELETE FROM customers WHERE business_id IN (
  SELECT id FROM businesses WHERE is_demo = true
);

-- Re-seed demo catalog
-- (run: npm run seed:demo)
```

**Warning**: Never run reset scripts against production unless you intend to clear demo data. `reset:demo` is safe by construction (flag-scoped), but the manual SQL above must keep its `is_demo` scope.

## Demo Indicators

The demo chooser page (`/demo`) includes a notice:
> "Demo data only. Bookings made here use fictional data. No real WhatsApp messages or calendar events will be sent."
