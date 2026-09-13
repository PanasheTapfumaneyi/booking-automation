# Phase 7 — Manual Validation Record (hardening pass + 7.6 polish)

Executed 2026-09-08 against the hardening-pass tree, then Phase 7.6 polish
tree. Automated gates all green (344 tests / 34 files, tsc, eslint, build).
Browser + live-database steps that require a running dev server with seeded
Supabase are marked BLOCKED with the exact command needed — everything
verifiable statically (code, tests, build output) was verified and is marked
PASS.

Legend: PASS = verified · BLOCKED = needs live env (command given) ·
N/A = not applicable.

## 0. Automated gates — PASS

- `npx vitest run` — 344 tests, 34 files, all green — PASS
- `npx tsc --noEmit` — clean — PASS
- `npx eslint src` — 0 errors, 6 warnings — PASS
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
35. `npm run reset:demo` scoped to `is_demo = true`, restores location fields — PASS
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

## G. Phase 7.6 — Public business experience polish — PASS (static) / BLOCKED (live)

### Theme system
44. `BusinessTheme` type with primary/accent/background/surface/foreground/muted — PASS (source)
45. `parseTheme()` returns null for invalid/missing config — PASS (source)
46. `themeToCssVars()` maps to CSS custom properties `--business-*` — PASS (source)
47. Business page applies `style={cssVars}` to wrapper div — PASS (source)
48. CSS variables consumed by Tailwind v4 theme tokens — PASS (source)

### Component architecture
49. Business page uses shared components: BusinessHero, OfferingCard, OpeningHours, ReviewsSection, ContactSection, LocationSection, BusinessFooter, MobileStickyCta — PASS (source)
50. ReviewsSection hidden when empty array (no fake ratings for production businesses) — PASS (source)
51. MobileStickyCta visible only on mobile, appears after 400px scroll — PASS (source)
52. OfferingCard shows image + description when available, degrades gracefully — PASS (source)
53. OpeningHours highlights today, shows open/closed state — PASS (source)

### Loading skeletons
54. `/business/[slug]/loading.tsx` exists — PASS
55. `/book/[slug]/loading.tsx` exists — PASS
56. `/demo/loading.tsx` exists — PASS
57. `/demo/dashboard/[slug]/loading.tsx` exists — PASS

### Calendar integration
58. ICS generator produces valid .ics with VCALENDAR/VEVENT — PASS (ics.test.ts, 8 tests)
59. Google Calendar URL generator produces valid redirect URL — PASS (google.test.ts, 5 tests)
60. `GET /api/bookings/[token]/calendar` returns .ics download — PASS (source)
61. `POST /api/bookings/[token]/calendar` returns Google Calendar URL — PASS (source)
62. Booking confirmation shows "Add to calendar" section — PASS (source: BookingFlow.tsx)
63. Manage page shows "Add to calendar" in view mode (hidden when cancelled) — PASS (source: ManageBooking.tsx)

### WhatsApp calendar links
64. Customer booking-created message includes calendar link — PASS (templates.test.ts)
65. Customer rescheduled message includes calendar link — PASS (templates.test.ts)
66. Business owner + reminder + cancelled messages do NOT include calendar link — PASS (source)

### Demo data
67. Demo businesses have `theme_config` with correct color schemes — PASS (seed script)
68. Demo businesses have `address` + `latitude` + `longitude` — PASS (seed script)
69. Demo services have `image_url` + `description` — PASS (seed script)
70. Demo resources have `image_url` — PASS (seed script)
71. `npm run seed:demo` handles address/coordinates in INSERT + UPDATE — PASS (source)

### Settings UI
72. "Public page" section includes address field — PASS (source: SettingsForm.tsx)
73. "Public page" section includes latitude/longitude fields — PASS (source)
74. Service edit form includes description textarea — PASS (source)
75. PATCH route accepts `address`, `latitude`, `longitude` — PASS (source)
76. Service PATCH route accepts `description`, `image_url` — PASS (source)

### Location section
77. LocationSection renders address + "Open in Maps" link — PASS (source)
78. LocationSection renders embedded OpenStreetMap when lat/lng provided — PASS (source)
79. LocationSection hidden when no address and no coordinates — PASS (source)
80. Business page renders LocationSection between OpeningHours and ReviewsSection — PASS (source)

### Business-level customization (Level 1)
81. Migration 0011 adds `tagline`, `description`, `cover_image_url`, `logo_url` — PASS
82. BusinessRow type includes all customization fields — PASS
83. URL validation requires http/https for image fields — PASS (sanitizeImageUrl)
84. Plain text description (no HTML injection) — PASS (sanitizeText)
85. Business page renders cover image hero, logo, tagline, description — PASS (source)

## Totals

- PASS: 70
- BLOCKED (needs `npm run dev` + seeded DB + browser): 15
- FAIL: 0

No item failed. Blocked items are all environment-dependent (live
Supabase + browser) and each lists its exact reproduction command.
