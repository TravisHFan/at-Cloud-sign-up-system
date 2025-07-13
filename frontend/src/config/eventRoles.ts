import type { EventRole } from "../types/event";

export const COMMUNICATION_WORKSHOP_ROLES: Omit<
  EventRole,
  "id" | "currentSignups"
>[] = [
  {
    name: "Spiritual Covering",
    description: "Prayer lead, feedback after Q&A, closing prayer",
    maxParticipants: 1, // Default is 1, can be set by event creator
  },
  {
    name: "Tech Lead",
    description: "Manages sound, video, and Zoom projection",
    maxParticipants: 1, // Default is 1, can be set by event creator
  },
  {
    name: "Tech Assistant",
    description: "Assists the Tech Lead",
    maxParticipants: 3, // Default is 3, can be set by event creator
  },
  {
    name: "Main Presenter",
    description: "Teaches communication best practices",
    maxParticipants: 1, // Default is 1, can be set by event creator
  },
  {
    name: "MC (Master of Ceremonies)",
    description: "Welcomes attendees, timekeeping, agenda announcements",
    maxParticipants: 1, // Default is 1, can be set by event creator
  },
  {
    name: "Zoom Director",
    description: "Supports Zoom participants, manages breakout rooms",
    maxParticipants: 1, // Default is 1, can be set by event creator
  },
  {
    name: "Zoom Co-host",
    description: "Assists Zoom Director",
    maxParticipants: 3, // Default is 3, can be set by event creator
  },
  {
    name: "Meeting Timer",
    description: "Tracks time, alerts MC (e.g., buzzer)",
    maxParticipants: 2, // Default is 2, can be set by event creator
  },
  {
    name: "Practice Group Leader (on-site)",
    description: "Guides breakout room discussions, answers questions",
    maxParticipants: 3, // Default is 3, can be set by event creator
  },
  {
    name: "Practice Group Leader (Zoom)",
    description: "Guides breakout room discussions, answers questions",
    maxParticipants: 2, // Default is 2, can be set by event creator
  },
  {
    name: "Prepared Speaker (on-site)",
    description: "Speakers for practice groups",
    maxParticipants: 3, // Default is 3, can be set by event creator
  },
  {
    name: "Prepared Speaker (Zoom)",
    description: "Speakers for practice groups",
    maxParticipants: 2, // Default is 2, can be set by event creator
  },
  {
    name: "Common Participant (on-site)",
    description: "General attendee",
    maxParticipants: 25, // Fixed at 25
  },
  {
    name: "Common Participant (Zoom)",
    description: "General attendee",
    maxParticipants: 25, // Fixed at 25
  },
];

// Future event type roles - ready for implementation
export const LEADERSHIP_SEMINAR_ROLES: Omit<
  EventRole,
  "id" | "currentSignups"
>[] = [
  {
    name: "Seminar Leader",
    description: "Leads the leadership development session",
    maxParticipants: 1,
  },
  {
    name: "Small Group Facilitator",
    description: "Facilitates small group discussions and activities",
    maxParticipants: 4,
  },
  {
    name: "Resource Coordinator",
    description: "Manages materials and resources for the seminar",
    maxParticipants: 1,
  },
  {
    name: "Tech Support",
    description: "Handles technical setup and troubleshooting",
    maxParticipants: 2,
  },
];

export const TECHNICAL_TRAINING_ROLES: Omit<
  EventRole,
  "id" | "currentSignups"
>[] = [
  {
    name: "Lead Instructor",
    description: "Primary technical instructor and subject matter expert",
    maxParticipants: 1,
  },
  {
    name: "Assistant Instructor",
    description: "Provides additional support and assistance",
    maxParticipants: 2,
  },
  {
    name: "Lab Assistant",
    description: "Helps with hands-on exercises and troubleshooting",
    maxParticipants: 3,
  },
  {
    name: "Equipment Manager",
    description: "Manages technical equipment and setup",
    maxParticipants: 1,
  },
];

// Simple events without specific roles
export const PRAYER_MEETING_ROLES: Omit<EventRole, "id" | "currentSignups">[] =
  [
    {
      name: "Prayer Leader",
      description: "Leads the prayer session and provides spiritual guidance",
      maxParticipants: 1,
    },
    {
      name: "Music Leader",
      description: "Leads worship music and songs (optional)",
      maxParticipants: 1,
    },
  ];

export const BIBLE_STUDY_ROLES: Omit<EventRole, "id" | "currentSignups">[] = [
  {
    name: "Study Leader",
    description: "Facilitates Bible study discussion and teaching",
    maxParticipants: 1,
  },
  {
    name: "Scripture Reader",
    description: "Reads selected Bible passages aloud",
    maxParticipants: 2,
  },
];

// Role mapping helper for dynamic role loading
export const getRolesByEventType = (
  eventTypeName: string
): Omit<EventRole, "id" | "currentSignups">[] => {
  switch (eventTypeName) {
    case "Effective Communication Workshop Series":
      return COMMUNICATION_WORKSHOP_ROLES;
    case "Leadership Development Seminar":
      return LEADERSHIP_SEMINAR_ROLES;
    case "Technical Skills Training":
      return TECHNICAL_TRAINING_ROLES;
    case "Prayer and Fellowship Meeting":
      return PRAYER_MEETING_ROLES;
    case "Bible Study Session":
      return BIBLE_STUDY_ROLES;
    default:
      return COMMUNICATION_WORKSHOP_ROLES; // Default fallback
  }
};
