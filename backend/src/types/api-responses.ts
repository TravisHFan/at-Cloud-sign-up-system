/**
 * Phase 2 Migration: API Response Interfaces
 *
 * Standardized response formats for Registration-based queries
 * These interfaces ensure consistency between backend and frontend
 */

export interface EventWithRegistrationData {
  id: string;
  title: string;
  type: string; // FIX: Add missing type field
  date: string;
  time: string;
  endTime: string;
  location: string;
  organizer: string;
  organizerDetails?: OrganizerDetail[];
  hostedBy?: string;
  purpose: string;
  agenda?: string;
  format: string;
  disclaimer?: string;
  description?: string;
  isHybrid?: boolean;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  requirements?: string;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  createdBy: UserBasicInfo;
  roles: EventRoleWithCounts[];
  totalCapacity: number;
  totalRegistrations: number;
  availableSpots: number;
  // FIX: Add frontend-compatible field names for event cards
  totalSlots: number;
  signedUp: number;
  // FIX: Add backward compatibility alias for tests expecting maxParticipants
  maxParticipants: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRoleWithCounts {
  id: string;
  name: string;
  description: string;
  maxParticipants: number;
  currentCount: number;
  availableSpots: number;
  isFull: boolean;
  waitlistCount: number;
  registrations: RegistrationWithUser[];
}

export interface RegistrationWithUser {
  id: string;
  userId: string;
  eventId: string;
  roleId: string;
  status: "active" | "cancelled" | "waitlist";
  user: UserBasicInfo;
  registeredAt: Date;
  eventSnapshot: {
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    roleName: string;
    roleDescription: string;
  };
}

export interface UserBasicInfo {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: "male" | "female";
  systemAuthorizationLevel: string;
  roleInAtCloud: string;
  role: string;
  avatar?: string;
}

export interface OrganizerDetail {
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar?: string;
  gender?: "male" | "female";
}

export interface EventListResponse {
  success: boolean;
  data: {
    events: EventWithRegistrationData[];
    totalEvents: number;
    totalPages: number;
    currentPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  message?: string;
}

export interface EventDetailResponse {
  success: boolean;
  data: EventWithRegistrationData;
  message?: string;
}

export interface UserSignupStatusResponse {
  success: boolean;
  data: {
    userId: string;
    eventId: string;
    isRegistered: boolean;
    currentRole?: string;
    canSignup: boolean;
    canSignupForMoreRoles: boolean;
    currentSignupCount: number;
    maxAllowedSignups: number;
    availableRoles: string[];
    restrictedRoles: string[];
  };
  message?: string;
}

export interface AnalyticsEventData {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  status: string;
  format: string;
  type: string;
  createdBy: UserBasicInfo;
  roles: {
    id: string;
    name: string;
    maxParticipants: number;
    currentCount: number;
    registrations: RegistrationWithUser[];
  }[];
  totalCapacity: number;
  totalRegistrations: number;
  registrationRate: number; // percentage
}

export interface AnalyticsResponse {
  success: boolean;
  data: {
    overview: {
      totalUsers: number;
      totalEvents: number;
      totalRegistrations: number;
      activeUsers: number;
      upcomingEvents: number;
      recentRegistrations: number;
    };
    eventAnalytics?: {
      eventsByType: Array<{ _id: string; count: number; percentage: number }>;
      eventsByFormat: Array<{ _id: string; count: number; percentage: number }>;
      registrationStats: Array<{
        _id: { year: number; month: number };
        totalRegistrations: number;
        averagePerEvent: number;
      }>;
      eventTrends: Array<{
        _id: { year: number; month: number };
        count: number;
      }>;
      upcomingEvents: AnalyticsEventData[];
      completedEvents: AnalyticsEventData[];
    };
    userAnalytics?: {
      usersByRole: Array<{ _id: string; count: number; percentage: number }>;
      userRegistrationActivity: Array<{
        _id: string;
        registrationCount: number;
        user: UserBasicInfo;
      }>;
      topParticipants: Array<{
        user: UserBasicInfo;
        eventCount: number;
        roles: string[];
      }>;
    };
  };
  message?: string;
}

export interface WebSocketEventUpdate {
  type:
    | "user_signed_up"
    | "user_cancelled"
    | "user_moved"
    | "event_updated"
    | "role_capacity_changed";
  eventId: string;
  data: {
    userId?: string;
    roleId?: string;
    fromRoleId?: string;
    toRoleId?: string;
    newCount?: number;
    event?: EventWithRegistrationData;
    role?: EventRoleWithCounts;
  };
  timestamp: Date;
}
