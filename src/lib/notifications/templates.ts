/**
 * WhatsApp message templates for booking notifications.
 *
 * Rendering rules (always enforced — see tests):
 *  - business identity always comes from `businessName` (never a hardcoded
 *    barbershop name/term);
 *  - times are rendered in the BUSINESS timezone via the shared time layer;
 *  - the customer message carries the /manage/[token] URL;
 *  - the business message never carries the manage URL/token nor Supabase ids;
 *  - rendered bodies are produced at dispatch time and never persisted.
 */
import {
  formatLongDateInZone,
  formatTimeInZone,
} from "@/lib/availability/time";
import type { BookingReminderType } from "./types";

export type NotificationTemplateType =
  | "booking.created"
  | "booking.rescheduled"
  | "booking.cancelled";

export interface TemplateContext {
  businessName: string;
  businessTimezone: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  startIso: string;
  endIso: string;
  /** Customer-only: public /manage/[token] URL. */
  manageUrl?: string;
  /** Customer-only: calendar download URL. */
  calendarUrl?: string;
  /** Reschedule only: the previously booked interval. */
  previousStartIso?: string;
  /** Item name for resource bookings (vehicle for rentals). Absent otherwise. */
  resourceName?: string;
  /** Pre-formatted booking total ("Rs 4,200") for unit-rate resource bookings. */
  displayTotal?: string;
}

function dayTime(iso: string, timezone: string): string {
  return `${formatLongDateInZone(iso, timezone)} at ${formatTimeInZone(iso, timezone)}`;
}

/** Item-aware label: `Car Rental (Toyota Vitz)` for rentals, service otherwise. */
function itemLabel(ctx: TemplateContext): string {
  return ctx.resourceName ? `${ctx.serviceName} (${ctx.resourceName})` : ctx.serviceName;
}

/** Optional total line, present only for rental/unit-rate bookings. */
function totalLine(ctx: TemplateContext): string | null {
  return ctx.displayTotal ? `Total: ${ctx.displayTotal}` : null;
}

// ---------------------------------------------------------------------------
// Customer-facing messages
// ---------------------------------------------------------------------------

export function customerCreatedMessage(ctx: TemplateContext): string {
  const lines = [
    `${ctx.businessName} — appointment confirmed`,
    "",
    `Hi ${ctx.customerName},`,
    `you're booked in for ${itemLabel(ctx)} on ${dayTime(ctx.startIso, ctx.businessTimezone)}.`,
  ];
  const total = totalLine(ctx);
  if (total) lines.push("", total);
  lines.push(
    "",
    `Manage this appointment: ${ctx.manageUrl ?? "—"}`,
    "",
    `Add to your calendar: ${ctx.calendarUrl ?? "—"}`,
  );
  return lines.join("\n");
}

export function customerRescheduledMessage(ctx: TemplateContext): string {
  const newTime = dayTime(ctx.startIso, ctx.businessTimezone);
  const previous = ctx.previousStartIso
    ? dayTime(ctx.previousStartIso, ctx.businessTimezone)
    : "—";
  const lines = [
    `${ctx.businessName} — appointment rescheduled`,
    "",
    `Hi ${ctx.customerName},`,
    `your ${itemLabel(ctx)} has moved to ${newTime}.`,
    "",
    `Previous time: ${previous}`,
  ];
  const total = totalLine(ctx);
  if (total) lines.push("", total);
  lines.push(
    "",
    `Manage this appointment: ${ctx.manageUrl ?? "—"}`,
    "",
    `Add to your calendar: ${ctx.calendarUrl ?? "—"}`,
  );
  return lines.join("\n");
}

export function customerCancelledMessage(ctx: TemplateContext): string {
  return [
    `${ctx.businessName} — appointment cancelled`,
    "",
    `Hi ${ctx.customerName},`,
    `your ${itemLabel(ctx)} on ${dayTime(ctx.startIso, ctx.businessTimezone)} has been cancelled.`,
    "",
    `Need to rebook? ${ctx.manageUrl ?? "Visit us again soon."}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Customer-facing reminder messages (Phase 5 — customer only, timed).
// Same rendering rules as confirmations: business timezone, manage URL.
// ---------------------------------------------------------------------------

export function customerReminder24hMessage(ctx: TemplateContext): string {
  return [
    `${ctx.businessName} — appointment reminder`,
    "",
    `Hi ${ctx.customerName},`,
    `just a reminder: your ${ctx.serviceName} is tomorrow, ${dayTime(ctx.startIso, ctx.businessTimezone)}.`,
    "",
    `Manage this appointment: ${ctx.manageUrl ?? "—"}`,
  ].join("\n");
}

export function customerReminder2hMessage(ctx: TemplateContext): string {
  return [
    `${ctx.businessName} — appointment reminder`,
    "",
    `Hi ${ctx.customerName},`,
    `just a reminder: your ${ctx.serviceName} is in about 2 hours, ${dayTime(ctx.startIso, ctx.businessTimezone)}.`,
    "",
    `Manage this appointment: ${ctx.manageUrl ?? "—"}`,
  ].join("\n");
}

export function buildReminderMessage(
  type: BookingReminderType,
  ctx: TemplateContext,
): string {
  switch (type) {
    case "booking.reminder.24h":
      return customerReminder24hMessage(ctx);
    case "booking.reminder.2h":
      return customerReminder2hMessage(ctx);
  }
}

// ---------------------------------------------------------------------------
// Business-facing messages (operational only — no manage URL, no Supabase ids)
// ---------------------------------------------------------------------------

export function businessCreatedMessage(ctx: TemplateContext): string {
  const lines = [
    `New booking — ${ctx.businessName}`,
    "",
    `${itemLabel(ctx)} on ${dayTime(ctx.startIso, ctx.businessTimezone)}`,
    `Customer: ${ctx.customerName} · ${ctx.customerPhone}`,
  ];
  if (ctx.displayTotal) lines.push(`Total: ${ctx.displayTotal}`);
  return lines.join("\n");
}

export function businessRescheduledMessage(ctx: TemplateContext): string {
  const moved = `${dayTime(ctx.startIso, ctx.businessTimezone)}`;
  const from = ctx.previousStartIso
    ? dayTime(ctx.previousStartIso, ctx.businessTimezone)
    : "—";
  const lines = [
    `Reschedule — ${ctx.businessName}`,
    "",
    `${itemLabel(ctx)} moved from ${from}`,
    `New: ${moved}`,
    `Customer: ${ctx.customerName} · ${ctx.customerPhone}`,
  ];
  if (ctx.displayTotal) lines.push(`Total: ${ctx.displayTotal}`);
  return lines.join("\n");
}

export function businessCancelledMessage(ctx: TemplateContext): string {
  return [
    `Cancellation — ${ctx.businessName}`,
    "",
    `${itemLabel(ctx)} on ${dayTime(ctx.startIso, ctx.businessTimezone)} cancelled`,
    `Customer: ${ctx.customerName} · ${ctx.customerPhone}`,
  ].join("\n");
}

export function buildCustomerMessage(
  type: NotificationTemplateType,
  ctx: TemplateContext,
): string {
  switch (type) {
    case "booking.created":
      return customerCreatedMessage(ctx);
    case "booking.rescheduled":
      return customerRescheduledMessage(ctx);
    case "booking.cancelled":
      return customerCancelledMessage(ctx);
  }
}

export function buildBusinessMessage(
  type: NotificationTemplateType,
  ctx: TemplateContext,
): string {
  switch (type) {
    case "booking.created":
      return businessCreatedMessage(ctx);
    case "booking.rescheduled":
      return businessRescheduledMessage(ctx);
    case "booking.cancelled":
      return businessCancelledMessage(ctx);
  }
}