export interface EventParticipant {
  userId: string; // Changed from number to string to match Management UUIDs
  username: string;
  firstName?: string; // Optional for flexibility
  lastName?: string; // Optional for flexibility
  email?: string;
  phone?: string;
  systemAuthorizationLevel?: string; // System authorization level (Super Admin, Administrator, Leader, Participant)
  roleInAtCloud?: string;
  avatar?: string;
  gender?: "male" | "female"; // For default avatar selection
  notes?: string;
}

export interface OrganizerDetail {
  userId?: string; // Optional user ID for clickable name cards
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar?: string | null;
  gender?: "male" | "female";
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
  id: string; // Changed from number to string for consistency
  title: string;
  type: string; // Changed from literal type to string
  date: string;
  time: string;
  endTime: string; // New field for event end time
  location: string;
  organizer: string;
  organizerDetails?: OrganizerDetail[]; // Optional detailed organizer information
  hostedBy?: string; // Hosted by information
  purpose: string;
  agenda?: string; // Event agenda and schedule
  format: string; // Changed from literal union to string
  disclaimer?: string; // Optional disclaimer terms

  // Role-based system (new requirement)
  roles: EventRole[];

  // Legacy properties for backward compatibility
  signedUp: number;
  totalSlots: number;

  // Optional properties
  description?: string;
  attendees?: number;
  status?: "completed" | "cancelled";
  isHybrid?: boolean;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  requirements?: string;
  materials?: string;

  // Workshop-specific topics per group A-F
  workshopGroupTopics?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
    E?: string;
    F?: string;
  };

  // Management properties
  createdBy: string; // Changed from number to string to match user UUIDs
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
