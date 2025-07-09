import type { EventData, EventStats } from "../types/event";

export function calculateUpcomingEventStats(events: EventData[]): EventStats {
  const totalEvents = events.length;
  const totalParticipants = events.reduce(
    (sum, event) => sum + event.signedUp,
    0
  );
  const availableSpots = events.reduce(
    (sum, event) => sum + (event.totalSlots - event.signedUp),
    0
  );

  return {
    totalEvents,
    totalParticipants,
    availableSpots,
  };
}

export function calculatePassedEventStats(events: EventData[]): EventStats {
  const totalEvents = events.length;
  const completedEvents = events.filter(
    (event) => event.status === "completed"
  ).length;
  const totalAttendees = events.reduce(
    (sum, event) => sum + (event.attendees || 0),
    0
  );
  const totalParticipants = events.reduce(
    (sum, event) => sum + event.signedUp,
    0
  );

  return {
    totalEvents,
    totalParticipants,
    totalAttendees,
    completedEvents,
  };
}

export function formatEventDate(date: string): string {
  const eventDate = new Date(date);
  return eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatEventTime(time: string): string {
  const [hour, minute] = time.split(":");
  const date = new Date();
  date.setHours(parseInt(hour), parseInt(minute));

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
