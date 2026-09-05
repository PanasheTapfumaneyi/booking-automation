/**
 * Resource availability strategy (foundation).
 *
 * "Is resource X available from start to end?" — a resource is unavailable
 * while an ACTIVE booking for that resource overlaps the requested range.
 *
 * Overlap test: existing.start < requested.end AND existing.end > requested.start
 * Back-to-back ranges (b.end === a.start) do NOT overlap and are permitted.
 * Cancelled bookings never block availability.
 */
import type { TimeBlock } from "./time";
import { doIntervalsOverlap } from "./time";

/** Pure overlap decision used by both the query layer and unit-style tests. */
export function isResourceBlocked(
  startIso: string,
  endIso: string,
  blocks: TimeBlock[],
): boolean {
  return blocks.some(
    (block) => doIntervalsOverlap(startIso, endIso, block.startTime, block.endTime),
  );
}