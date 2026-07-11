import { toInstantFromWallClock } from "./timezoneUtils";

export type ActiveEventStatus = "upcoming" | "ongoing" | "completed";

/** Derive event status without mutating the persisted event document. */
export function deriveEventStatus(
  eventDate: string,
  eventEndDate: string,
  eventTime: string,
  eventEndTime: string,
  timeZone?: string,
  now = new Date(),
): ActiveEventStatus {
  const startInstant = toInstantFromWallClock(eventDate, eventTime, timeZone);
  const endInstant = toInstantFromWallClock(
    eventEndDate || eventDate,
    eventEndTime,
    timeZone,
  );

  if (endInstant < startInstant) {
    endInstant.setTime(startInstant.getTime());
  }

  if (now < startInstant) return "upcoming";
  if (now < endInstant) return "ongoing";
  return "completed";
}
