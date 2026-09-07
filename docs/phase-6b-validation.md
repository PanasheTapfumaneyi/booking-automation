# Phase 6B — Manual validation checklist

Operational dashboard + business booking management. Unit coverage stands
in for logic; the steps below need a live browser + live Supabase with
migration `0008_dashboard_indexes.sql` applied (0007 must already be live).
Do NOT include Phase 5 reminder live tests here — tracked separately.

## 0. Prerequisites

- `.env.local` has `NEXT_PUBLIC_SUPABASE_ANON_KEY`; dev server restarted
  (production: rebuilt) after adding it.
- Logged in as an existing Phase 6A owner whose business has at least one
  service; Baileys service running + linked if WhatsApp checks are wanted.

## 1. Dashboard overview (as owner A)

1. Open `/dashboard` → correct business name, today's date, timezone.
2. "Today" section lists today's bookings chronologically (spot-check
   against the site clock in the business timezone, not UTC).
3. "Coming next" lists upcoming bookings; counts match the sections.
4. `Notifications failed` / `Calendar issues` cards show sane numbers
   (0 in a healthy pilot).
5. Empty states: a business with no bookings shows "No bookings today"
   with a working New booking CTA.
6. "Copy booking link" copies `/book/<slug>`; opening it logged-out
   shows the public flow for the right business.

## 2. Booking list

7. `/dashboard/bookings` tabs: Today / Upcoming / Past / Cancelled / All
   each show the right subset (create or cancel a test booking to move
   rows between tabs and re-check).
8. Search by customer name, then by phone fragment — only matching rows.
9. Optional service/date filters narrow the list; Clear resets.
10. New booking button opens the manual flow (leave open for step 14).

## 3. Public booking appears (live end-to-end)

11. Logged out, create a booking through `/book/<slug>`.
12. Refresh `/dashboard` → new booking appears under Today/Upcoming.
13. Open its details: customer, service, time correct; **no manage_token
    anywhere on the page** (view source and search for the token from the
    WhatsApp message — must be absent).
14. Notification timeline shows Customer WhatsApp Sent; calendar shows
    Synced (if connected).

## 4. Manual business booking

15. From `/dashboard/bookings?new=1`: pick service → date → slot →
    search existing customer (select one) → Confirm. Booking appears in
    the list; DB row has the correct `business_id`; calendar event
    created if connected; WhatsApp confirmation sends.
16. Repeat with a brand-new name/phone → new customer row created
    (same phone twice reuses the customer — check `customers` table).
17. Pick an already-taken slot → clear conflict message, no duplicate.

## 5. Reschedule from dashboard

18. Open a booking → Reschedule → new date/time → Confirm.
19. Dashboard time updates; Google event **updates in place** (same event —
    check the calendar, no duplicate event).
20. Reschedule WhatsApp arrives; the customer's original manage URL still
    opens the booking with the new time and unchanged token behavior.

## 6. Cancel from dashboard

21. Cancel with the confirm dialog → status Cancelled, row stays in
    history (Cancelled tab).
22. DB row is `cancelled`, not deleted; calendar event removed/cancelled;
    cancellation WhatsApp arrives.
23. Cancel again (or reload + cancel) → safe, no error cascade.

## 7. Isolation (second owner)

24. Log in as a second business owner (different business).
25. Confirm none of owner A's bookings/customers appear anywhere.
26. Directly open owner A's booking detail URL while logged in as B →
    safe "not found" page, no data.
27. Directly call (logged in as B):
    `GET /api/businesses/<A-id>/bookings/<A-booking-id>` → 404;
    `POST .../cancel` → 404. Nothing in the bodies identifies A's data
    beyond "not found".

## 8. Public regression (logged out)

28. `/book`, `/book/<slug>`, `/manage/<token>` all work without auth;
    create/reschedule/cancel behave exactly as before.
29. `/dashboard`, `/settings`, `/onboarding` logged out → `/login`.

## 9. Other modes (smoke)

30. Resource business: manual booking picks item + start/end; conflict
    on overlap returns 409; detail shows the item name.
31. Capacity business: manual booking picks departure + guests; over-
    capacity is refused; detail shows session + quantity.

## 10. Restart + gates

32. Restart Kivo → calendar stays connected (no re-auth loop).
33. `npm test` green (241 tests), `npx tsc --noEmit`, `npx eslint src`,
    `npm run build` clean.
