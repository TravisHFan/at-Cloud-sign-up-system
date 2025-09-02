// Canonical Event Type templates (read-only)
// These mirror the frontend templates to avoid drift and enable server-side validation/UI consumption.

export type TemplateRole = {
  name: string;
  description: string;
  maxParticipants: number;
};

export const ALLOWED_EVENT_TYPES = [
  "Conference",
  "Webinar",
  "Effective Communication Workshop",
  "Mentor Circle",
] as const;

export type AllowedEventType = (typeof ALLOWED_EVENT_TYPES)[number];

// Conference keeps existing communication workshop roles
export const CONFERENCE_ROLES: TemplateRole[] = [
  {
    name: "Spiritual Covering",
    description: "Prayer lead, feedback after Q&A, closing prayer",
    maxParticipants: 1,
  },
  {
    name: "Tech Lead",
    description: "Manages sound, video, and Zoom projection",
    maxParticipants: 1,
  },
  {
    name: "Tech Assistant",
    description: "Assists the Tech Lead",
    maxParticipants: 3,
  },
  {
    name: "Main Presenter",
    description: "Teaches communication best practices",
    maxParticipants: 1,
  },
  {
    name: "MC (Master of Ceremonies)",
    description: "Welcomes attendees, timekeeping, agenda announcements",
    maxParticipants: 1,
  },
  {
    name: "Zoom Director",
    description: "Supports Zoom participants, manages breakout rooms",
    maxParticipants: 1,
  },
  {
    name: "Zoom Co-host",
    description: "Assists Zoom Director",
    maxParticipants: 1,
  },
  {
    name: "Meeting Timer",
    description: "Tracks time, alerts MC (e.g., buzzer)",
    maxParticipants: 1,
  },
  {
    name: "Practice Group Leader (on-site)",
    description: "Guides breakout room discussions, answers questions",
    maxParticipants: 3,
  },
  {
    name: "Practice Group Leader (Zoom)",
    description: "Guides breakout room discussions, answers questions",
    maxParticipants: 2,
  },
  {
    name: "Prepared Speaker (on-site)",
    description: "Speakers for practice groups",
    maxParticipants: 3,
  },
  {
    name: "Prepared Speaker (Zoom)",
    description: "Speakers for practice groups",
    maxParticipants: 2,
  },
  {
    name: "Common Participant (on-site)",
    description: "General attendee",
    maxParticipants: 25,
  },
  {
    name: "Common Participant (Zoom)",
    description: "General attendee",
    maxParticipants: 25,
  },
];

export const WEBINAR_ROLES: TemplateRole[] = [
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

export const MENTOR_CIRCLE_ROLES: TemplateRole[] = [
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

const WORKSHOP_GROUPS = ["A", "B", "C", "D", "E", "F"] as const;
export const WORKSHOP_ROLES: TemplateRole[] = [
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
      "Provide all mentee presenters with evaluations and feedback to help improve their communication skills",
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
  ...WORKSHOP_GROUPS.flatMap((g) => [
    {
      name: `Group ${g} Leader`,
      description: `• Leades Group ${g} to practice assigned communication skills from last month\n• Deliver a 6–7 minute presentation (with PPT, role play, or story)\n• Receive feedback from mentors, evaluator`,
      maxParticipants: 1,
    },
    {
      name: `Group ${g} Participants`,
      description: `Participants in Group ${g} to practice assigned communication skills from last month\n• Deliver a 6–7 minute presentation (with PPT, role play, or story)\n• Receive feedback from mentors, evaluator`,
      maxParticipants: 3,
    },
  ]),
];

export const EVENT_TEMPLATES: Record<AllowedEventType, TemplateRole[]> = {
  Conference: CONFERENCE_ROLES,
  Webinar: WEBINAR_ROLES,
  "Effective Communication Workshop": WORKSHOP_ROLES,
  "Mentor Circle": MENTOR_CIRCLE_ROLES,
};

export function getEventTemplates() {
  return {
    allowedTypes: ALLOWED_EVENT_TYPES,
    templates: EVENT_TEMPLATES,
  };
}
