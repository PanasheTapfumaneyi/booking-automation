# Phase 7 — Manual Validation Record (hardening pass)

Executed 2026-09-08 against the hardening-pass tree. Automated gates all
green (327 tests / 32 files, tsc, eslint, build). Browser + live-database
steps that require a running dev server with seeded Supabase are marked
BLOCKED with the exact command needed — everything verifiable statically
(code, tests, build output) was verified and is marked PASS.

Legend: PASS = verified · BLOCKED = needs live env (command given) ·
N/A = not applicable.

## 0. Automated gates — PASS

- `npx vitest run` — 327 tests, 32 files, all green — PASS
- `npx tsc --noEmit` — clean — PASS
- `npx eslint src` — 0 errors, 0 warnings — PASS
- `npm run build` — clean; routes `/business/[slug]`, `/demo`,
  `/demo/dashboard/[slug]` present in output — PASS

## A. Main demo CTA — PASS (static) / BLOCKED (visual)

1. Desktop header shows Sign In · View Demo · [Get Started →] — PASS
   (source-asserted in `marketing.test.ts`, ≥2 `/demo` hrefs)
2. Mobile menu includes View Demo + Get Started — PASS (source)
3. Hero: primary Get Started, secondary View Demo, tertiary
   "See how it works" text link — PASS (source)
4. Final CTA keeps Get Started button + "Explore the live demo" link — PASS (source)
5. All demo links point to `/demo` — PASS (grep)
6. Desktop/mobile visual check in a real browser — BLOCKED
   (`npm run dev`, open `/` at 375px / 1280px)

## B. Demo business dashboard — PASS (static) / BLOCKED (live)

7. `/demo/dashboard/fade-area` route exists in build — PASS
8. Loads without auth (no `getRequestUser`/redirect in page) — PASS (source)
9. Only `is_demo` businesses resolve; others → 404 — PASS
   (`getDemoDashboardData` gate + `demo-dashboard.test.ts` non-demo case)
10. No mutation surfaces: no `<form>`, actions, client state, or tokens
    in the page — PASS (grep; only server `getSupabase` import)
11. No raw PII: page references only `customerDisplay`/`phoneDisplay` — PASS
    (grep; masking unit-tested)
12. Demo banner + "Start your own Kivo workspace" CTA present — PASS (source)
13. Normal `/dashboard` still requires auth (untouched guards) — PASS (source)
14. Live render with seeded data (all 3 modes) — BLOCKED
    (`npm run dev` + `npm run seed:demo`, visit each dashboard URL)
15. Cross-business read attempt in browser returns 404 — BLOCKED
    (visit `/demo/dashboard/<production-slug>`)

## C. Business public website — PASS (static) / BLOCKED (live)

16. `/business/[slug]` route exists in build — PASS
17. Unknown slug → `notFound()` — PASS (source + `public-site.test.ts`)
18. Appointment site lists active services w/ duration + price — PASS (test)
19. Resource site lists active resources — PASS (test)
20. Capacity site lists future sessions soonest-first, full state — PASS (test)
21. All Book CTAs lead to existing `/book/[slug]` flow — PASS (source)
22. No booking logic duplicated into the site page — PASS (source:
    page calls `BookingFlow` route only via link)
23. "Powered by Kivo" present, business identity leads — PASS (source)
24. No customer/booking/token data in site payload — PASS (test)
25. Live render + mobile layout for all 3 demo sites — BLOCKED
    (`npm run dev` + `npm run seed:demo`)

## D. Demo safety — PASS

26. WhatsApp suppression uses `isDemoBusiness()` (explicit flag) — PASS
    (source + `demo-safety.test.ts`)
27. Calendar suppression uses `isDemoBusiness()` — PASS (source + test)
28. No UUID-prefix sniffing anywhere in `src/` — PASS (grep, zero matches)
29. All `is_demo` references are server-side or tests — PASS (grep)
30. Forged client flags have no effect (guards receive service-role rows;
    missing flag = production) — PASS (unit tests)
31. Production dispatch path unchanged — PASS (existing notification tests)
32. No secrets in demo/business pages (service-role import is server-only,
    no tokens/keys in JSX) — PASS (grep)
33. Live no-send verification — BLOCKED (make demo booking, confirm no
    WhatsApp/Calendar activity in provider dashboards)

## E. Demo seed / reset — PASS (static) / BLOCKED (live)

34. `npm run seed:demo` script present, idempotent, demo-only — PASS (source)
35. `npm run reset:demo` scoped to `is_demo = true`, catalog untouched — PASS
36. `0009` left intact historically; `0010_demo_flag.sql` schema-only — PASS
37. Live seed + reset against dev Supabase — BLOCKED
    (`npm run seed:demo`, verify 3 slugs, `npm run reset:demo`, verify
    catalog intact and non-demo rows untouched)

## F. Original Phase 7 checklist (carried over)

38. Marketing homepage sections render (hero, how-it-works, types,
    preview, why, CTA, footer) — BLOCKED (browser; code + build PASS)
39. Responsive 375/430/768/1024/1280/1440 — BLOCKED (browser)
40. Reduced-motion disables animation — BLOCKED (browser emulation;
    CSS guard present — PASS by source)
41. Appointment/resource/capacity booking flows intact — PASS
    (all Phase 6C tests green, booking engine untouched)
42. Manage-booking flow intact — PASS (tests green)
43. No console errors — BLOCKED (browser)

## Totals

- PASS: 30
- BLOCKED (needs `npm run dev` + seeded DB + browser): 13
- FAIL: 0

No item failed. Blocked items are all environment-dependent (live
Supabase + browser) and each lists its exact reproduction command.
