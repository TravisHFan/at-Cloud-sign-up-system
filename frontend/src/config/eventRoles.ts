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
    maxParticipants: 1, // Default is 1, can be set by event creator
  },
  {
    name: "Meeting Timer",
    description: "Tracks time, alerts MC (e.g., buzzer)",
    maxParticipants: 1, // Default is 1, can be set by event creator
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

// New Event Type Role Sets (Blueprint-driven)
export const WEBINAR_ROLES: Omit<EventRole, "id" | "currentSignups">[] = [
  {
    name: "Opening prayer",
    description: "Leads the opening prayer",
    maxParticipants: 1,
  },
  {
    name: "Zoom Master",
    description: "Manages Zoom meeting settings and flow",
    maxParticipants: 2,
  },
  {
    name: "MC or Moderator",
    description: "Hosts the session and facilitates discussion",
    maxParticipants: 1,
  },
  {
    name: "Speakers",
    description: "Delivers prepared talks or presentations",
    maxParticipants: 4,
  },
  {
    name: "Closing prayer",
    description: "Leads the closing prayer",
    maxParticipants: 1,
  },
  // Circle-specific Breakout Room Leads (default 2 each)
  {
    name: "Breakout Room Leads for E Circle",
    description: "Leads breakout discussions and supports attendees",
    maxParticipants: 2,
  },
  {
    name: "Breakout Room Leads for M Circle",
    description: "Leads breakout discussions and supports attendees",
    maxParticipants: 2,
  },
  {
    name: "Breakout Room Leads for B Circle",
    description: "Leads breakout discussions and supports attendees",
    maxParticipants: 2,
  },
  {
    name: "Breakout Room Leads for A Circle",
    description: "Leads breakout discussions and supports attendees",
    maxParticipants: 2,
  },
];

export const MENTOR_CIRCLE_ROLES: Omit<EventRole, "id" | "currentSignups">[] = [
  {
    name: "Mentors",
    description: "Provides mentorship and guidance",
    maxParticipants: 5,
  },
  {
    name: "Class Representatives",
    description: "Coordinates communication between mentees and mentors",
    maxParticipants: 2,
  },
  {
    name: "Mentees",
    description: "Participants receiving mentorship",
    maxParticipants: 25,
  },
];

// Generate Workshop group roles A–F
const WORKSHOP_GROUPS = ["A", "B", "C", "D", "E", "F"] as const;

export const WORKSHOP_ROLES: Omit<EventRole, "id" | "currentSignups">[] = [
  {
    name: "Zoom Host",
    description:
      "• Provide technical support for online participants\n• Collect and manage online questions\n• Give clear instructions to participants\n• Organize breakout rooms when needed",
    maxParticipants: 1,
  },
  {
    name: "Zoom Co-host",
    description: "Assists the Zoom Host with moderation",
    maxParticipants: 1,
  },
  {
    name: "Spiritual Cover",
    description:
      "• Open the meeting with prayer\n• Provide feedback or reflection after the Q&A session\n• Close the meeting with prayer and blessings",
    maxParticipants: 1,
  },
  {
    name: "Opening Keynote Speaker",
    description:
      "• Warm up the group and especially encourage presenters\n• Set the tone with inspiration and positivity",
    maxParticipants: 1,
  },
  {
    name: "Evaluators",
    description:
      "Provide all mentee presenters with evaluations and feedback to help improve\ntheir communication skills",
    maxParticipants: 4,
  },
  {
    name: "Closing Keynote Speaker",
    description:
      "• Share next month’s practice skills and focus\n• Give practical tips, examples, and encouragement for upcoming practice",
    maxParticipants: 1,
  },
  {
    name: "Content Master",
    description:
      "• Assign homework for continued practice\n• Share supporting references, reading links, or videos\n• Encourage participants to sign up for the next session",
    maxParticipants: 1,
  },
  {
    name: "Meeting Timer",
    description:
      "• Track each segment of the agenda carefully\n• Notify MC when time is up (with gentle signal, buzzer, or beeper)\n• Help keep the meeting on schedule",
    maxParticipants: 1,
  },
  // Groups A–F: Leader (1) + Participants (3)
  ...WORKSHOP_GROUPS.flatMap((g) => [
    {
      name: `Group ${g} Leader`,
      description: `• Lead Group ${g} in practicing the communication skills assigned last month\n• Deliver a 6–7 minute presentation (with PPT, role play, or story)\n• Receive feedback from mentors, evaluator`,
      maxParticipants: 1,
    },
    {
      name: `Group ${g} Participants`,
      description: `• Join Group ${g} to practice the communication skills assigned last month\n• Deliver a 6–7 minute presentation (with PPT, role play, or story)\n• Receive feedback from mentors, evaluator`,
      maxParticipants: 3,
    },
  ]),
];

// Role mapping helper for dynamic role loading
export const getRolesByEventType = (
  eventTypeName: string
): Omit<EventRole, "id" | "currentSignups">[] => {
  switch (eventTypeName) {
    case "Conference":
      // Conference keeps existing role-set as-is
      return COMMUNICATION_WORKSHOP_ROLES;
    case "Webinar":
      return WEBINAR_ROLES;
    case "Mentor Circle":
      return MENTOR_CIRCLE_ROLES;
    case "Effective Communication Workshop":
      return WORKSHOP_ROLES;
    // Backward compatibility: if any legacy value remains
    case "Workshop":
      return WORKSHOP_ROLES;
    default:
      return COMMUNICATION_WORKSHOP_ROLES;
  }
};
