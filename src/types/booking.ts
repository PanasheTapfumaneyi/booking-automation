export type BookingMode = "appointment" | "resource" | "capacity";

export interface Business {
  id: string;
  name: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  timezone: string;
  address: string;
  addressNote: string;
  hours: OpeningHours;
  bookingMode?: BookingMode;
}

export interface OpeningHours {
  mondayFriday: string;
  saturday: string;
  sunday: string;
}

export interface Service {
  id: string;
  businessId: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  active: boolean;
}

/** A generic reservable thing (car, boat, room, stylist, instructor…). */
export interface Resource {
  id: string;
  businessId: string;
  name: string;
  resourceType: string;
  active: boolean;
}

/**
 * A scheduled occurrence with limited capacity (tour departure, class, …).
 * Bookings consume `capacity` via their `quantity`.
 */
export interface BookingSession {
  id: string;
  businessId: string;
  serviceId: string;
  startTime: string;
  endTime: string | null;
  capacity: number;
  active: boolean;
  /** Active booked quantity across all non-cancelled bookings. */
  booked: number;
  /** capacity - booked (never negative; clamped at display). */
  remaining: number;
}

export type BookingStatus =
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "no_show";

export interface Booking {
  id: string;
  businessId: string;
  serviceId: string;
  customerId: string;
  // Mode-specific references (null for appointment bookings).
  resourceId: string | null;
  sessionId: string | null;
  quantity: number;
  // Denormalized snapshot fields (kept in sync from service + customer on create).
  serviceName: string;
  servicePrice: number;
  serviceDurationMinutes: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  status: BookingStatus;
  googleEventId: string | null;
  manageToken: string;
  previousStartTime: string | null; // set on reschedule
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email: string | null;
}

export interface TimeSlot {
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  label: string; // "14:00"
}

export interface NewBookingInput {
  serviceId: string;
  startTime: string;
  endTime: string;
  name: string;
  phone: string;
  email?: string;
  // Resource-mode: the resource being reserved.
  resourceId?: string | null;
  // Capacity-mode: the session the booking consumes capacity from.
  sessionId?: string | null;
  quantity?: number;
}