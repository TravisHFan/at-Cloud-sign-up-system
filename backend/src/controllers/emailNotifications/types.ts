/**
 * Shared types for Email Notification Controllers
 */

export interface EventCreatedRequest {
  eventData: {
    title: string;
    date: string;
    time: string;
    location: string;
    organizerName: string;
    endTime?: string;
    zoomLink?: string;
    purpose?: string;
    format?: string;
  };
  excludeEmail?: string;
}

export interface SystemAuthorizationChangeRequest {
  userData: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    oldRole: string;
    newRole: string;
  };
  changedBy: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    avatar?: string;
    gender?: string;
  };
}

export interface AtCloudRoleChangeRequest {
  userData: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    oldRoleInAtCloud: string;
    newRoleInAtCloud: string;
  };
}

export interface NewLeaderSignupRequest {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    roleInAtCloud: string;
  };
}

export interface CoOrganizerAssignedRequest {
  assignedUser: {
    email: string;
    firstName: string;
    lastName: string;
  };
  eventData: {
    title: string;
    date: string;
    time: string;
    location: string;
  };
  assignedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface EventReminderRequest {
  eventId: string;
  eventData: {
    title: string;
    date: string;
    time: string;
    location: string;
    zoomLink?: string;
    format?: string;
  };
  reminderType?: "1h" | "24h" | "1week";
}
