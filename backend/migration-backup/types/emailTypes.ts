// Email notification types for AtCloud Ministry System

export interface EventReminderRequest {
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  location?: string;
  description?: string;
  zoomLink?: string;
  format: "in-person" | "virtual" | "hybrid";
  reminderType: "1h" | "24h" | "1week";
}

export interface EmailTemplate {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SystemAuthRequest {
  recipientEmail: string;
  recipientName: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

export interface AtCloudRoleChangeRequest {
  recipientEmail: string;
  recipientName: string;
  action: "promoted" | "demoted";
  newRole: string;
  oldRole: string;
  adminName: string;
  adminEmail: string;
  timestamp: string;
}

export interface NewLeaderSignupRequest {
  recipientEmail: string;
  recipientName: string;
  leaderName: string;
  leaderEmail: string;
  leaderMinistry: string;
  signupTimestamp: string;
}

export interface CoOrganizerAssignmentRequest {
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation?: string;
  mainOrganizerName: string;
  mainOrganizerEmail: string;
}
