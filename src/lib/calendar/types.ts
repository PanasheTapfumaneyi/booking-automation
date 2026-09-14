export interface CalendarEvent {
  businessName: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  timezone: string;
  location?: string;
  description?: string;
  manageUrl?: string;
  /** Item name for resource bookings (vehicle for rentals). */
  resourceName?: string;
  /** Customer name — used for the rental .ics title. */
  customerName?: string;
}
