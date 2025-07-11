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
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + days);

  return events.filter((event) => {
    const eventDate = new Date(event.date);
    return eventDate >= now && eventDate <= futureDate;
  });
}
