/**
 * Availability engine entry point.
 *
 * Shared timezone/format helpers plus the appointment, resource and capacity
 * strategies. Client components import these helpers through `@/lib/availability`
 * (this barrel file).
 */
export {
  SLOT_INTERVAL_MINUTES,
  BOOKING_WINDOW_DAYS,
  DEFAULT_TIMEZONE,
  type TimeBlock,
} from "./time";

export {
  getLocalDayInfo,
  formatTimeInZone,
  formatLongDateInZone,
  formatTime,
  formatLongDate,
  isoToDateKey,
  toDateKey,
  minutesToLabel,
  addDaysKey,
  doIntervalsOverlap,
  zonedInstant,
} from "./time";

export {
  getOpeningRange,
  getSlotsForDay,
  isDateKeyAvailable,
} from "./appointment";

export {
  type BusinessHours,
  type DayHours,
  type WeekdayKey,
  WEEKDAY_KEYS,
  weekdayKeyFromJsDay,
  parseBusinessHours,
} from "./hours";

export { isResourceBlocked } from "./resource";

export { hasRemainingCapacity, remainingCapacity, clampQuantity } from "./capacity";