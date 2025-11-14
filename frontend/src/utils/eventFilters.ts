import type { EventData } from "../types/event";
import { hasEventPassed, isEventUpcoming } from "./eventStatsUtils";

/**
 * Filter events to get only upcoming events (end time has not passed)
 */
export function getUpcomingEvents(events: EventData[]): EventData[] {
  return events.filter((event) => isEventUpcoming(event));
}

/**
 * Filter events to get only passed events (end time has passed)
 */
export function getPassedEvents(events: EventData[]): EventData[] {
  return events.filter((event) => hasEventPassed(event));
}

/**
 * Automatically categorize all events into upcoming and passed based on end times
 */
export function categorizeEvents(allEvents: EventData[]): {
  upcomingEvents: EventData[];
  passedEvents: EventData[];
} {
  const upcomingEvents: EventData[] = [];
  const passedEvents: EventData[] = [];

  allEvents.forEach((event) => {
    if (hasEventPassed(event)) {
      passedEvents.push(event);
    } else {
      upcomingEvents.push(event);
    }
  });

  return { upcomingEvents, passedEvents };
}

/**
 * Get events that are happening today
 */
export function getTodaysEvents(events: EventData[]): EventData[] {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  return events.filter((event) => event.date === today);
}

/**
 * Get events happening within the next N days
 */
export function getEventsInNextDays(
  events: EventData[],
  days: number
): EventData[] {
  // Use UTC to avoid timezone issues with date-only strings
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const futureDate = new Date(today);
  futureDate.setUTCDate(today.getUTCDate() + days);
  futureDate.setUTCHours(23, 59, 59, 999);

  return events.filter((event) => {
    const eventDate = new Date(event.date);
    eventDate.setUTCHours(0, 0, 0, 0);
    return eventDate >= today && eventDate <= futureDate;
  });
}
