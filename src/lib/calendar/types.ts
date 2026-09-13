export interface CalendarEvent {
  businessName: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  timezone: string;
  location?: string;
  description?: string;
  manageUrl?: string;
}
