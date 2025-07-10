export interface EventParticipant {
  userId: number;
  username: string;
  firstName?: string; // Optional for flexibility
  lastName?: string; // Optional for flexibility
  roleInAtCloud?: string;
  avatar?: string;
  gender?: "male" | "female"; // For default avatar selection
  notes?: string;
}

export interface EventRole {
  id: string;
  name: string;
  description: string;
  maxParticipants: number;
  currentSignups: EventParticipant[]; // Ensure this is strictly an array of EventParticipant
}

// Updated EventData interface
export interface EventData {
  id: number;
  title: string;
  type: string; // Changed from literal type to string
  date: string;
  time: string;
  location: string;
  organizer: string;
  purpose: string;
  format: string; // Changed from literal union to string
  disclaimer: string;

  // Role-based system (new requirement)
  roles: EventRole[];

  // Legacy properties for backward compatibility
  signedUp: number;
  totalSlots: number;

  // Optional properties
  description?: string;
  category?: string;
  attendees?: number;
  status?: "completed" | "cancelled";
  isHybrid?: boolean;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  requirements?: string;
  materials?: string;

  // Management properties
  createdBy: number;
  createdAt: string;
}

export interface EventStats {
  totalEvents: number;
  totalParticipants: number;
  availableSpots?: number; // For upcoming events
  totalAttendees?: number; // For passed events
  completedEvents?: number; // For passed events
}

export type EventListType = "upcoming" | "passed";
