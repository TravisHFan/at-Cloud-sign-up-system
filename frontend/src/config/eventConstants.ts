export const EVENT_CATEGORIES = [
  "Workshop",
  "Seminar",
  "Training",
  "Conference",
  "Prayer Meeting",
  "Bible Study",
  "Outreach",
  "Youth Ministry",
  "Leadership",
  "Other",
] as const;

export const EVENT_TYPES = [
  {
    id: "communication-workshop",
    name: "Effective Communication Workshop Series",
    description: "Professional communication skills development workshop",
    requiresRoles: true,
    requiresDisclaimer: false,
    defaultRoles: "COMMUNICATION_WORKSHOP_ROLES",
  },
  {
    id: "leadership-seminar",
    name: "Leadership Development Seminar",
    description: "Leadership skills and team management training",
    requiresRoles: true,
    requiresDisclaimer: true,
    defaultRoles: "LEADERSHIP_SEMINAR_ROLES", // Future implementation
  },
  {
    id: "technical-training",
    name: "Technical Skills Training",
    description: "Hands-on technical skills development",
    requiresRoles: true,
    requiresDisclaimer: true,
    defaultRoles: "TECHNICAL_TRAINING_ROLES", // Future implementation
  },
  {
    id: "prayer-meeting",
    name: "Prayer and Fellowship Meeting",
    description: "Community prayer and spiritual fellowship",
    requiresRoles: false,
    requiresDisclaimer: false,
    defaultRoles: null,
  },
  {
    id: "bible-study",
    name: "Bible Study Session",
    description: "Interactive Bible study and discussion",
    requiresRoles: false,
    requiresDisclaimer: false,
    defaultRoles: null,
  },
] as const;

export const DEFAULT_EVENT_VALUES = {
  // Required fields with sensible defaults
  type: "",
  date: "",
  time: "",
  endTime: "",
  organizer: "",
  purpose: "",
  agenda: "",
  format: "",

  // Optional fields
  hostedBy: "@Cloud Marketplace Ministry",
  location: "",
  disclaimer: "",
  zoomLink: "",
  meetingId: "",
  passcode: "",
  requirements: "",
  materials: "",

  // System fields (optional/auto-generated)
  id: "",
  title: "",
  description: "",
  category: "",
  isHybrid: false,
  roles: [],
  signedUp: 0,
  totalSlots: 50,
  createdBy: "",
  createdAt: "",
};

export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type EventTypeId = EventType["id"];
