# Phase 6A — Manual validation checklist

Business auth, onboarding, settings, and per-business booking pages.
Unit coverage stands in for logic; the steps below need a live browser +
live Supabase. Do not claim success until each step is actually performed.

## 0. Prerequisites (Supabase dashboard + terminal, once)

1. Apply migration `supabase/migrations/0007_business_auth_membership.sql`
   (dashboard → SQL Editor → paste → Run). It backfills slug
   `fade-district` for the demo business.
2. Verify RLS landed (SQL Editor):
   ```sql
   select tablename, policyname
     from pg_policies
    where schemaname = 'public'
      and tablename in ('business_members','businesses','services','bookings')
    order by tablename, policyname;
   -- expect *_select_member / *_select_own policies on every table
   ```
3. Auth settings (dashboard → Authentication → Providers → Email): leave
   email+password ON. For the pilot, turn OFF "Confirm email" so signup
   returns a session immediately (otherwise the signup UI shows a
   check-your-inbox state — also fine, just slower to test).
4. Auth → URL Configuration: Site URL `http://localhost:3000` (local).
5. `.env.local` must contain `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable
   key, Project Settings → API). Restart Next.js after adding it.
6. Negative RLS probe (proves isolation before trusting it):
   - user A (owner of business A) must get zero rows from
     `select * from services` with the anon key + A's JWT where every
     service belongs to business B, and vice versa. Easiest via two test
     users after step 1 below, using the Supabase table editor's
     "run as" is NOT available — instead call the app's own settings APIs
     cross-business (step 18).

## 1. Owner account + onboarding

1. Open `/signup`, create an account (e.g. `owner-a@test.example`).
2. Confirm the browser lands on `/onboarding` automatically
   (no membership yet).
3. Step 1: name `Test Cuts`, phone, timezone, mode **appointment** →
   Continue. A business row + owner membership + default notification
   settings are created; slug is derived from the name.
4. Step 2: service `Test Cut`, 45 min, Rs 500 → Continue.
5. Step 3: set Monday 10:00–16:00, Sunday closed → Continue.
6. Step 4: enter a test WhatsApp number → Continue.
7. Step 5: either connect Google Calendar or Skip → land on `/dashboard`.

## 2. Dashboard + settings

8. `/dashboard` lists `Test Cuts` with "View booking page" + "Settings".
   Log out (`/logout` or Dashboard → Log out) → `/dashboard` redirects to
   `/login`. Log back in → lands on `/dashboard` (not `/login`).
9. `/settings`: edit profile name/phone, change Monday hours, add a second
   service, deactivate it, re-activate it. Each save shows confirmation;
   bad input (empty name, inverted hours, negative price) shows a
   validation error and writes nothing.
10. Notifications section: save/clear the WhatsApp number; toggle owner
    alerts off/on. Invalid numbers are rejected.
11. Integrations: Google shows connected/account (or not connected with a
    working Connect link); WhatsApp "Check" reports available while
    baileys-service runs.

## 3. Public booking for the new business

12. Open `/book/<slug-from-step-3>` (slug shown on the settings page).
    Services listed are the new business's only; unknown slug → 404 page.
13. Create a customer booking for the nearest valid slot.
14. Confirm in Supabase (table editor): booking row has the new
    `business_id`; Google event created if calendar connected;
    WhatsApp confirmation arrives if Baileys is up.
15. `/book` (no slug) still books Fade District — backward compatible.

## 4. Isolation

16. Sign up a second user (`owner-b@test.example`), onboard a second
    business. As user B, open `/settings?business=<business-A-id>` →
    expect "You don't have access" behavior (settings falls back to B's
    own business only; direct API calls return 403).
17. As user B, `GET /api/businesses/<business-A-id>` → 403;
    `POST /api/businesses/<business-A-id>/services` → 403.
18. Google: as user B, `GET /api/integrations/google-calendar/status?business=<business-A-id>`
    → 403. As user A → 200.

## 5. Other modes (smoke)

19. Resource: onboard with mode **rental**, add an item. Confirm settings
    shows items + an auto-created booking service.
20. Capacity: onboard with mode **group sessions**, add a service + one
    session (date/time/guests). Confirm the session lists as active and
    can be deactivated.

## 6. Regression (customer side untouched)

21. `/manage/<token>` for an existing booking still loads, reschedules,
    and cancels.
22. `npm test` green (219 tests), `npx tsc --noEmit` clean,
    `npx eslint src` clean, `npm run build` clean.

## Scheduler/deploy note (Phase 5 endpoint, unchanged)

`POST /api/internal/reminders/run` is still Bearer-secret based and host
agnostic. Later invocation options: Vercel Cron (`vercel.json` crons +
project env for the secret), GitHub Actions scheduled curl (needs a public
URL), an external cron service, or a small always-on timer process. No
integration added in this phase.
