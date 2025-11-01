// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    role: string;
    isAtCloudLeader: boolean;
    roleInAtCloud?: string;
    avatar?: string;
    weeklyChurch?: string;
    churchAddress?: string;
    occupation?: string;
    company?: string;
    homeAddress?: string;
    lastLogin?: string;
    createdAt?: string;
    isVerified?: boolean;
    isActive?: boolean;
  };
  accessToken: string;
  expiresAt: string;
}

// Minimal payload shape used in tests for updateEvent
export type UpdateEventPayload = Record<string, unknown> & {
  organizerDetails: unknown[];
  forceDeleteRegistrations?: boolean; // Force delete all registrations when applying template
};

// Minimal guest summary for admin views and token-based management
export interface GuestSummary {
  id?: string;
  _id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
  roleId: string;
  manageToken?: string;
}

// Program participant types
export type ProgramParticipant = {
  user: {
    _id?: string; // For direct Mongoose documents
    id?: string; // For JSON-serialized responses
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
    gender?: "male" | "female";
    roleInAtCloud?: string;
  };
  isPaid: boolean;
  enrollmentDate: string;
};

export type ProgramParticipantsResponse = {
  mentees: ProgramParticipant[];
  classReps: ProgramParticipant[];
};

// Re-export public event types from main types
export type {
  PublicEventData,
  PublicEventListItem,
  PublicRegistrationPayload,
  PublicRegistrationResponse,
} from "../../../types/publicEvent";
