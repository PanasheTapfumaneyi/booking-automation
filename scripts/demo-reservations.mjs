/**
 * Canonical demo reservations — shared by `seed-demo.mjs` and `reset-demo.mjs`.
 *
 * Gives each demo business a realistic, deterministic set of bookings so the
 * dashboards look alive and the rental fleet shows blocked vehicles in the
 * interval availability search. All rows are inserted directly and ONLY for
 * `is_demo = true` businesses (resolved server-side from the slug + flag).
 *
 * `applyDemoReservations(db)` is idempotent: it skips any booking that
 * already exists for the same scope (business + resource or service + start).
 */
import { randomUUID } from "node:crypto";

export const DEMO_RESERVATIONS = [
  // ---- Kivo Drive (car rental, resource mode) ----
  {
    slug: "kivo-drive",
    name: "Ayesha Ramdin",
    phone: "+230 51 45 1111",
    email: "ayesha@example.mu",
    service: "Car Rental",
    resource: "Toyota Vitz",
    start: "2026-10-08T10:00:00+04:00",
    end: "2026-10-10T10:00:00+04:00",
    status: "confirmed",
  },
  {
    slug: "kivo-drive",
    name: "Kevin Belcourt",
    phone: "+230 52 67 2222",
    email: "kevin@example.mu",
    service: "Car Rental",
    resource: "Hyundai Creta",
    start: "2026-10-10T08:00:00+04:00",
    end: "2026-10-12T08:00:00+04:00",
    status: "confirmed",
  },
  {
    slug: "kivo-drive",
    name: "Marie Zephyr",
    phone: "+230 53 78 3333",
    email: "marie@example.mu",
    service: "Car Rental",
    resource: "Suzuki Swift",
    start: "2026-09-03T09:00:00+04:00",
    end: "2026-09-04T09:00:00+04:00",
    status: "completed",
  },

  // ---- Fade Area (appointments) ----
  {
    slug: "fade-area",
    name: "Chris Lenoir",
    phone: "+230 54 12 9001",
    email: "chris@example.mu",
    service: "Haircut",
    start: "2026-10-09T10:00:00+04:00",
    end: "2026-10-09T10:45:00+04:00",
    status: "confirmed",
  },
  {
    slug: "fade-area",
    name: "Sana Beegun",
    phone: "+230 55 22 8002",
    email: "sana@example.mu",
    service: "Beard Trim",
    start: "2026-09-28T14:00:00+04:00",
    end: "2026-09-28T14:30:00+04:00",
    status: "completed",
  },

  // ---- Blue Lagoon (capacity) ----
  {
    slug: "blue-lagoon",
    name: "Ravi Beeharry",
    phone: "+230 56 31 7003",
    email: "ravi@example.mu",
    service: "Group Swimming Lesson",
    session: "2026-10-01T08:00:00+04:00",
    quantity: 2,
    start: "2026-10-01T08:00:00+04:00",
    end: "2026-10-01T09:00:00+04:00",
    status: "confirmed",
  },
  {
    slug: "blue-lagoon",
    name: "Nadia Pillay",
    phone: "+230 57 40 6004",
    email: "nadia@example.mu",
    service: "Kids Adventure Swim",
    session: "2026-10-03T09:00:00+04:00",
    quantity: 3,
    start: "2026-10-03T09:00:00+04:00",
    end: "2026-10-03T09:45:00+04:00",
    status: "confirmed",
  },
];

/**
 * Create any missing canonical reservations. Returns the number created.
 * Skips rows that already exist (same business + resource/service + start).
 */
export async function applyDemoReservations(db) {
  let created = 0;
  for (const r of DEMO_RESERVATIONS) {
    const { data: biz } = await db
      .from("businesses")
      .select("id")
      .eq("slug", r.slug)
      .eq("is_demo", true)
      .maybeSingle();
    if (!biz) continue;

    const { data: service } = await db
      .from("services")
      .select("id")
      .eq("business_id", biz.id)
      .eq("name", r.service)
      .maybeSingle();
    if (!service) continue;

    let resourceId = null;
    if (r.resource) {
      const { data: res } = await db
        .from("resources")
        .select("id")
        .eq("business_id", biz.id)
        .eq("name", r.resource)
        .maybeSingle();
      resourceId = res?.id ?? null;
    }

    let sessionId = null;
    if (r.session) {
      const { data: sess } = await db
        .from("booking_sessions")
        .select("id")
        .eq("business_id", biz.id)
        .eq("start_time", new Date(r.session).toISOString())
        .maybeSingle();
      sessionId = sess?.id ?? null;
    }

    // Customer upsert by (business, phone).
    let customerId;
    const { data: existingCustomer } = await db
      .from("customers")
      .select("id")
      .eq("business_id", biz.id)
      .eq("phone", r.phone)
      .maybeSingle();
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: ins, error: cErr } = await db
        .from("customers")
        .insert({ business_id: biz.id, name: r.name, phone: r.phone, email: r.email ?? null })
        .select("id")
        .single();
      if (cErr) throw cErr;
      customerId = ins.id;
    }

    const startIso = new Date(r.start).toISOString();
    // Idempotency: skip an existing booking for the same scope + start time.
    let query = db
      .from("bookings")
      .select("id")
      .eq("business_id", biz.id)
      .eq("start_time", startIso);
    if (resourceId) {
      query = query.eq("resource_id", resourceId);
    } else {
      query = query.eq("service_id", service.id);
    }
    const { data: existing } = await query.maybeSingle();
    if (existing) {
      created += 0;
      continue;
    }

    const { error: bErr } = await db.from("bookings").insert({
      business_id: biz.id,
      service_id: service.id,
      customer_id: customerId,
      resource_id: resourceId,
      session_id: sessionId,
      quantity: r.quantity ?? 1,
      start_time: startIso,
      end_time: new Date(r.end).toISOString(),
      status: r.status,
      manage_token: randomUUID(),
    });
    if (bErr) throw bErr;
    created++;
  }
  return created;
}