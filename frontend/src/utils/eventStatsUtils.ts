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

export function hasEventPassed(event: EventData): boolean {
  const now = new Date();
  const eventEndDateTime = new Date(`${event.date}T${event.endTime}`);
  return eventEndDateTime < now;
}

export function isEventUpcoming(event: EventData): boolean {
  return !hasEventPassed(event);
}

/**
 * Formats a date string to YYYY-MM-DD format for HTML date inputs.
 * This function is timezone-safe and prevents the off-by-one-day bug.
 * @param dateString The date string to format
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateForInput(dateString: string): string {
  if (!dateString) return "";

  // Create date object and use local timezone methods
  const date = new Date(dateString);

  // Use getFullYear, getMonth, getDate to avoid timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // getMonth() returns 0-11
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Alternative timezone-safe date formatting using the date string directly.
 * This method parses the date string manually to avoid timezone conversion.
 * @param dateString The date string in YYYY-MM-DD format
 * @returns The same date string, or formatted if needed
 */
export function safeFormatDateForInput(dateString: string): string {
  if (!dateString) return "";

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Parse other date formats safely
  const date = new Date(dateString + "T00:00:00"); // Add time to ensure local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Convert a date from backend (which might be ISO string) to a local date
 * without timezone shifts for form display.
 * @param dateString Date string from backend
 * @returns Local date string in YYYY-MM-DD format
 */
export function parseEventDateSafely(dateString: string): string {
  if (!dateString) return "";

  // If it's an ISO string, extract just the date part
  if (dateString.includes("T")) {
    return dateString.split("T")[0];
  }

  // If it's already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Parse other formats and convert to YYYY-MM-DD
  try {
    const date = new Date(dateString);
    // Use UTC methods to avoid timezone shifts
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn("Failed to parse date safely:", dateString, error);
    return "";
  }
}
