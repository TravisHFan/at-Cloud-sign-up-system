export interface EventData {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  signedUp: number;
  totalSlots: number;
  attendees?: number; // Only for passed events
  status?: "completed" | "cancelled"; // Only for passed events
}

export interface EventStats {
  totalEvents: number;
  totalParticipants: number;
  availableSpots?: number; // For upcoming events
  totalAttendees?: number; // For passed events
  completedEvents?: number; // For passed events
}

export type EventListType = "upcoming" | "passed";
