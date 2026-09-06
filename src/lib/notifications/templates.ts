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
  /** Reschedule only: the previously booked interval. */
  previousStartIso?: string;
}

function dayTime(iso: string, timezone: string): string {
  return `${formatLongDateInZone(iso, timezone)} at ${formatTimeInZone(iso, timezone)}`;
}

// ---------------------------------------------------------------------------
// Customer-facing messages
// ---------------------------------------------------------------------------

export function customerCreatedMessage(ctx: TemplateContext): string {
  return [
    `${ctx.businessName} — appointment confirmed`,
    "",
    `Hi ${ctx.customerName},`,
    `you're booked in for ${ctx.serviceName} on ${dayTime(ctx.startIso, ctx.businessTimezone)}.`,
    "",
    `Manage this appointment: ${ctx.manageUrl ?? "—"}`,
  ].join("\n");
}

export function customerRescheduledMessage(ctx: TemplateContext): string {
  const newTime = dayTime(ctx.startIso, ctx.businessTimezone);
  const previous = ctx.previousStartIso
    ? dayTime(ctx.previousStartIso, ctx.businessTimezone)
    : "—";
  return [
    `${ctx.businessName} — appointment rescheduled`,
    "",
    `Hi ${ctx.customerName},`,
    `your ${ctx.serviceName} has moved to ${newTime}.`,
    "",
    `Previous time: ${previous}`,
    "",
    `Manage this appointment: ${ctx.manageUrl ?? "—"}`,
  ].join("\n");
}

export function customerCancelledMessage(ctx: TemplateContext): string {
  return [
    `${ctx.businessName} — appointment cancelled`,
    "",
    `Hi ${ctx.customerName},`,
    `your ${ctx.serviceName} on ${dayTime(ctx.startIso, ctx.businessTimezone)} has been cancelled.`,
    "",
    `Need to rebook? ${ctx.manageUrl ?? "Visit us again soon."}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Business-facing messages (operational only — no manage URL, no Supabase ids)
// ---------------------------------------------------------------------------

export function businessCreatedMessage(ctx: TemplateContext): string {
  return [
    `New booking — ${ctx.businessName}`,
    "",
    `${ctx.serviceName} on ${dayTime(ctx.startIso, ctx.businessTimezone)}`,
    `Customer: ${ctx.customerName} · ${ctx.customerPhone}`,
  ].join("\n");
}

export function businessRescheduledMessage(ctx: TemplateContext): string {
  const moved = `${dayTime(ctx.startIso, ctx.businessTimezone)}`;
  const from = ctx.previousStartIso
    ? dayTime(ctx.previousStartIso, ctx.businessTimezone)
    : "—";
  return [
    `Reschedule — ${ctx.businessName}`,
    "",
    `${ctx.serviceName} moved from ${from}`,
    `New: ${moved}`,
    `Customer: ${ctx.customerName} · ${ctx.customerPhone}`,
  ].join("\n");
}

export function businessCancelledMessage(ctx: TemplateContext): string {
  return [
    `Cancellation — ${ctx.businessName}`,
    "",
    `${ctx.serviceName} on ${dayTime(ctx.startIso, ctx.businessTimezone)} cancelled`,
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