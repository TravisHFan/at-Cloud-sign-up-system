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
  // Parse date string safely to avoid timezone issues
  let eventDate: Date;

  if (date.includes("T")) {
    // If it's an ISO string, use it directly
    eventDate = new Date(date);
  } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // If it's YYYY-MM-DD format, parse manually to avoid timezone shift
    const [year, month, day] = date.split("-").map(Number);
    eventDate = new Date(year, month - 1, day); // month is 0-indexed
  } else {
    // Fallback to regular parsing for other formats
    eventDate = new Date(date);
  }

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
 * Safely formats any date string to display format, avoiding timezone issues.
 * @param dateString The date string to format
 * @param options Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function safeFormatDate(
  dateString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  // Parse date string safely to avoid timezone issues
  let date: Date;

  if (dateString.includes("T")) {
    // If it's an ISO string, use it directly (for timestamps)
    date = new Date(dateString);
  } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // If it's YYYY-MM-DD format, parse manually to avoid timezone shift
    const [year, month, day] = dateString.split("-").map(Number);
    date = new Date(year, month - 1, day); // month is 0-indexed
  } else {
    // Fallback to regular parsing for other formats
    date = new Date(dateString);
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  return date.toLocaleDateString("en-US", options || defaultOptions);
}

/**
 * Converts a date string to American format (MM/DD/YYYY).
 * @param dateString The date string to format
 * @returns Date in American format (e.g., "08/09/2025")
 */
export function formatDateToAmerican(dateString: string): string {
  if (!dateString) return "";

  // Parse date string safely to avoid timezone issues
  let date: Date;

  if (dateString.includes("T")) {
    // If it's an ISO string, use it directly
    date = new Date(dateString);
  } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // If it's YYYY-MM-DD format, parse manually to avoid timezone shift
    const [year, month, day] = dateString.split("-").map(Number);
    date = new Date(year, month - 1, day); // month is 0-indexed
  } else {
    // Fallback to regular parsing for other formats
    date = new Date(dateString);
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Formats a date string to YYYY-MM-DD format for HTML date inputs.
 * This function is completely timezone-safe and prevents the off-by-one-day bug.
 * @param dateString The date string to format
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateForInput(dateString: string): string {
  if (!dateString) return "";

  // If it's an ISO string, extract just the date part
  if (dateString.includes("T")) {
    return dateString.split("T")[0];
  }

  // If it's already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // For other formats, parse manually to avoid timezone issues
  try {
    // Create date with explicit timezone handling
    const date = new Date(dateString + "T12:00:00"); // Add noon time to avoid timezone edge cases

    // Use local date methods (not UTC) for consistent behavior
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn("Failed to format date for input:", dateString, error);
    return "";
  }
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
    // Create date with explicit noon time to avoid timezone edge cases
    const date = new Date(dateString + "T12:00:00");

    // Use local date methods for consistent behavior
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn("Failed to parse date safely:", dateString, error);
    return "";
  }
}

/**
 * Completely manual date parsing that avoids all timezone issues.
 * Use this for critical date operations where timezone must not affect the result.
 * @param dateInput Date string from user input or form
 * @returns Normalized date string in YYYY-MM-DD format
 */
export function normalizeEventDate(dateInput: string): string {
  if (!dateInput) return "";

  // Clean the input
  const cleanInput = dateInput.trim();

  // If it's already in YYYY-MM-DD format, validate and return
  const yyyymmddMatch = cleanInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    // Validate ranges
    if (
      yearNum >= 1900 &&
      yearNum <= 9999 &&
      monthNum >= 1 &&
      monthNum <= 12 &&
      dayNum >= 1 &&
      dayNum <= 31
    ) {
      console.log("✅ normalizeEventDate output (already valid):", cleanInput);
      return cleanInput;
    }
  }

  // Try to parse other common formats manually
  const slashMatch = cleanInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // MM/DD/YYYY
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const result = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    console.log("✅ normalizeEventDate output (from MM/DD/YYYY):", result);
    return result;
  }

  const dashMatch = cleanInput.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); // MM-DD-YYYY or DD-MM-YYYY
  if (dashMatch) {
    const [, first, second, year] = dashMatch;
    // Assume MM-DD-YYYY format
    const result = `${year}-${first.padStart(2, "0")}-${second.padStart(
      2,
      "0"
    )}`;
    console.log("✅ normalizeEventDate output (from MM-DD-YYYY):", result);
    return result;
  }

  // As last resort, try Date constructor with noon time
  try {
    const date = new Date(cleanInput + "T12:00:00");
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const result = `${year}-${month}-${day}`;
      console.log(
        "✅ normalizeEventDate output (from Date constructor):",
        result
      );
      return result;
    }
  } catch (error) {
    console.warn("❌ Failed to normalize date:", cleanInput, error);
  }

  console.warn("❌ Could not normalize date:", cleanInput);
  return "";
}

/**
 * Special handler for HTML date input onChange events.
 * Ensures the selected date is preserved exactly as selected by the user.
 * @param inputValue The value from the date input element
 * @returns Normalized date string that preserves the user's selection
 */
export function handleDateInputChange(inputValue: string): string {
  if (!inputValue) return "";

  console.log("📅 Date input change:", inputValue);

  // HTML date inputs always return YYYY-MM-DD format
  // We should preserve this exactly to avoid any timezone conversion
  if (/^\d{4}-\d{2}-\d{2}$/.test(inputValue)) {
    console.log("✅ Date input preserved:", inputValue);
    return inputValue;
  }

  // If somehow we get a different format, normalize it
  const normalized = normalizeEventDate(inputValue);
  console.log("🔄 Date input normalized:", normalized);
  return normalized;
}
