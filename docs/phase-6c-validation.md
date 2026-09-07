# Phase 6C — Manual validation checklist

Resource-mode and capacity-mode booking workflows for the business dashboard and public customer booking page.
Extends Phase 6B. Requires migrations 0007 + 0008 already live. Tests: 298.

## 0. Prerequisites

- Dev server running with `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
- Logged in as a business owner whose `booking_mode` is `resource` or `capacity`.
- For resource mode: at least one active resource created in Settings.
- For capacity mode: at least one active session created in Settings.

## 1. Resource mode — dashboard overview

1. `/dashboard` shows a "Resources" card listing active resources.
2. Each resource links to `/dashboard/bookings?resourceId=<id>`.
3. Inactive resources are not listed.

## 2. Resource mode — bookings list filtering

4. `/dashboard/bookings?resourceId=<id>` shows only bookings for that resource.
5. "Showing bookings for this item · Show all" banner appears; "Show all" clears the filter.
6. Service and date filters stack with the resource filter.

## 3. Resource mode — reschedule from dashboard

7. Open a resource booking → Reschedule → pick new date + start time + end time.
8. Dashboard updates; booking's `resource_id` is unchanged (same item).
9. Overlapping another active booking on the same resource → 409 conflict, no change.
10. Rescheduling to the same time is allowed (self-exclusion works).
11. Deactivated resource → booking still visible but reschedule is refused.

## 4. Resource mode — create from dashboard

12. New booking → pick service → pick resource → enter start + end time → confirm.
13. Missing resource → validation error. Missing endTime → validation error.
14. End before start → validation error. Past time → validation error.

## 5. Capacity mode — dashboard overview

15. `/dashboard` shows a "Sessions" card listing active sessions.
16. Each session shows `booked/capacity` (e.g. "3/10 booked").
17. Each session links to `/dashboard/bookings?sessionId=<id>`.

## 6. Capacity mode — bookings list filtering

18. `/dashboard/bookings?sessionId=<id>` shows only bookings for that session.
19. "Showing bookings for this departure · Show all" banner appears.
20. Guest count per booking is shown in the list.

## 7. Capacity mode — session management

21. Settings → edit session → change capacity above booked count → saved.
22. Reduce capacity below booked count → "Cannot reduce capacity below X" error.
23. Change session start/end time → saved. Invalid times → validation error.

## 8. Capacity mode — "cancel and rebook"

24. Open a capacity booking → Reschedule shows "This booking type cannot be rescheduled" with Cancel + Rebook CTAs.
25. Cancel works as in Phase 6B. Rebook creates a new booking (not a move).

## 9. Settings — session edit UI

26. Settings page shows sessions with `booked`/`remaining` display.
27. Edit session: change capacity, start time, end time.
28. Deactivate/reactivate session toggle works.

## 10. Public booking — resource mode (`/book/<slug>`)

29. `/book/<slug>` for a resource-mode business shows the service list.
30. Select service → resource picker appears listing active resources.
31. Select resource → date picker appears.
32. Select date → available start/end time slots appear (no overlap with existing bookings).
33. Pick a time → contact form → confirm → booking created with correct `resource_id`, `start_time`, `end_time`.
34. No available time → "No available times" message.
35. Cross-business resource ID in request → rejected with RESOURCE_NOT_FOUND.

## 11. Public booking — capacity mode (`/book/<slug>`)

36. `/book/<slug>` for a capacity-mode business shows the service list.
37. Select service → session cards appear showing date, time, booked/remaining.
38. Active sessions with remaining capacity show a "Book" button.
39. Select session → quantity selector (default 1, max = remaining).
40. Contact form → confirm → booking created with correct `session_id`, `quantity`.
41. Session at capacity → "Full" badge, no book button.
42. Cross-business session ID in request → rejected with SESSION_NOT_FOUND.

## 12. Public booking — manage (`/book/<slug>/manage/<token>`)

43. Appointment booking → reschedule shows slot picker with date and start time.
44. Resource booking → reschedule shows date + start/end time pickers (same service, same resource).
45. Capacity booking → "This booking type cannot be rescheduled. Cancel and rebook instead."
46. Resource reschedule to overlapping time on same resource → conflict error.
47. Resource reschedule to same time → allowed (self-exclusion).

## 13. Booking summary page

48. Resource/capacity bookings show start–end time range instead of duration.
49. Appointment bookings still show duration as before.

## 14. Regression

50. Appointment mode: all Phase 6B steps still pass unchanged.
51. All three modes render correctly on `/book/<slug>`.

## 15. Gates

52. `npx vitest run` — 298 tests, 28 files, all green.
53. `npx tsc --noEmit` — clean.
54. `npx eslint src` — clean.
55. `npm run build` — clean.
