-- Phase 7: Demo businesses
-- Creates 3 demo businesses for the public demo environment.
-- Run after all prior migrations (0001–0008) are applied.
-- Safe to rerun: each block first removes ONLY a broken row (right slug,
-- wrong id — left by an interrupted run), which cascades to its partial
-- children. Healthy rows (right slug + deterministic id) are never touched,
-- so reruns never wipe real demo bookings.

-- 1. Appointment: Fade Area
DELETE FROM businesses WHERE slug = 'fade-area' AND id != '10000000-0000-4000-8000-000000000001'::uuid;
INSERT INTO businesses (id, name, phone, email, timezone, booking_mode, slug)
VALUES ('10000000-0000-4000-8000-000000000001'::uuid, 'Fade Area', '+230 5711 1111', 'demo@fadearea.mu', 'Indian/Mauritius', 'appointment'::booking_mode, 'fade-area')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email,
  timezone = EXCLUDED.timezone, booking_mode = EXCLUDED.booking_mode;

-- 2. Resource: Island Surf Co.
DELETE FROM businesses WHERE slug = 'island-surf' AND id != '10000000-0000-4000-8000-000000000002'::uuid;
INSERT INTO businesses (id, name, phone, email, timezone, booking_mode, slug)
VALUES ('10000000-0000-4000-8000-000000000002'::uuid, 'Island Surf Co.', '+230 5722 2222', 'demo@islandsurf.mu', 'Indian/Mauritius', 'resource'::booking_mode, 'island-surf')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email,
  timezone = EXCLUDED.timezone, booking_mode = EXCLUDED.booking_mode;

-- 3. Capacity: Blue Lagoon Swim School
DELETE FROM businesses WHERE slug = 'blue-lagoon' AND id != '10000000-0000-4000-8000-000000000003'::uuid;
INSERT INTO businesses (id, name, phone, email, timezone, booking_mode, slug)
VALUES ('10000000-0000-4000-8000-000000000003'::uuid, 'Blue Lagoon Swim School', '+230 5733 3333', 'demo@bluelagoon.mu', 'Indian/Mauritius', 'capacity'::booking_mode, 'blue-lagoon')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email,
  timezone = EXCLUDED.timezone, booking_mode = EXCLUDED.booking_mode;

-- Services (insert only if business exists and service doesn't)
INSERT INTO services (business_id, name, duration_minutes, price, active)
SELECT b.id, 'Haircut', 45, 450, true FROM businesses b WHERE b.slug = 'fade-area'
AND NOT EXISTS (SELECT 1 FROM services s WHERE s.business_id = b.id AND s.name = 'Haircut');

INSERT INTO services (business_id, name, duration_minutes, price, active)
SELECT b.id, 'Beard Trim', 30, 250, true FROM businesses b WHERE b.slug = 'fade-area'
AND NOT EXISTS (SELECT 1 FROM services s WHERE s.business_id = b.id AND s.name = 'Beard Trim');

INSERT INTO services (business_id, name, duration_minutes, price, active)
SELECT b.id, 'Consultation', 30, 0, true FROM businesses b WHERE b.slug = 'fade-area'
AND NOT EXISTS (SELECT 1 FROM services s WHERE s.business_id = b.id AND s.name = 'Consultation');

INSERT INTO services (business_id, name, duration_minutes, price, active)
SELECT b.id, 'Daily Board Rental', 1440, 1200, true FROM businesses b WHERE b.slug = 'island-surf'
AND NOT EXISTS (SELECT 1 FROM services s WHERE s.business_id = b.id AND s.name = 'Daily Board Rental');

INSERT INTO resources (business_id, name, resource_type, active)
SELECT b.id, 'Shortboard — 6ft', 'equipment', true FROM businesses b WHERE b.slug = 'island-surf'
AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.business_id = b.id AND r.name = 'Shortboard — 6ft');

INSERT INTO resources (business_id, name, resource_type, active)
SELECT b.id, 'Longboard — 8ft', 'equipment', true FROM businesses b WHERE b.slug = 'island-surf'
AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.business_id = b.id AND r.name = 'Longboard — 8ft');

INSERT INTO resources (business_id, name, resource_type, active)
SELECT b.id, 'Paddleboard — 10ft', 'equipment', true FROM businesses b WHERE b.slug = 'island-surf'
AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.business_id = b.id AND r.name = 'Paddleboard — 10ft');

INSERT INTO services (business_id, name, duration_minutes, price, active)
SELECT b.id, 'Group Swimming Lesson', 60, 350, true FROM businesses b WHERE b.slug = 'blue-lagoon'
AND NOT EXISTS (SELECT 1 FROM services s WHERE s.business_id = b.id AND s.name = 'Group Swimming Lesson');

INSERT INTO services (business_id, name, duration_minutes, price, active)
SELECT b.id, 'Kids Adventure Swim', 45, 280, true FROM businesses b WHERE b.slug = 'blue-lagoon'
AND NOT EXISTS (SELECT 1 FROM services s WHERE s.business_id = b.id AND s.name = 'Kids Adventure Swim');

-- Sessions for Group Swimming Lesson
INSERT INTO booking_sessions (business_id, service_id, start_time, end_time, capacity, active)
SELECT b.id, s.id, '2026-10-01T08:00:00+04:00'::timestamptz, '2026-10-01T09:00:00+04:00'::timestamptz, 10, true
FROM businesses b JOIN services s ON s.business_id = b.id
WHERE b.slug = 'blue-lagoon' AND s.name = 'Group Swimming Lesson'
AND NOT EXISTS (SELECT 1 FROM booking_sessions bs WHERE bs.business_id = b.id AND bs.start_time = '2026-10-01T08:00:00+04:00'::timestamptz);

INSERT INTO booking_sessions (business_id, service_id, start_time, end_time, capacity, active)
SELECT b.id, s.id, '2026-10-01T10:00:00+04:00'::timestamptz, '2026-10-01T11:00:00+04:00'::timestamptz, 8, true
FROM businesses b JOIN services s ON s.business_id = b.id
WHERE b.slug = 'blue-lagoon' AND s.name = 'Group Swimming Lesson'
AND NOT EXISTS (SELECT 1 FROM booking_sessions bs WHERE bs.business_id = b.id AND bs.start_time = '2026-10-01T10:00:00+04:00'::timestamptz);

INSERT INTO booking_sessions (business_id, service_id, start_time, end_time, capacity, active)
SELECT b.id, s.id, '2026-10-02T08:00:00+04:00'::timestamptz, '2026-10-02T09:00:00+04:00'::timestamptz, 10, true
FROM businesses b JOIN services s ON s.business_id = b.id
WHERE b.slug = 'blue-lagoon' AND s.name = 'Group Swimming Lesson'
AND NOT EXISTS (SELECT 1 FROM booking_sessions bs WHERE bs.business_id = b.id AND bs.start_time = '2026-10-02T08:00:00+04:00'::timestamptz);

-- Session for Kids Adventure Swim
INSERT INTO booking_sessions (business_id, service_id, start_time, end_time, capacity, active)
SELECT b.id, s.id, '2026-10-03T09:00:00+04:00'::timestamptz, '2026-10-03T09:45:00+04:00'::timestamptz, 6, true
FROM businesses b JOIN services s ON s.business_id = b.id
WHERE b.slug = 'blue-lagoon' AND s.name = 'Kids Adventure Swim'
AND NOT EXISTS (SELECT 1 FROM booking_sessions bs WHERE bs.business_id = b.id AND bs.start_time = '2026-10-03T09:00:00+04:00'::timestamptz);
