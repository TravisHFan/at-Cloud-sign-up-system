export const EVENT_CATEGORIES = [
  "Workshop",
  "Professional Development",
  "Other",
] as const;

interface EventTypeConfig {
  id: string;
  name: string;
  description: string;
  duration: string;
  maxParticipants: number;
  defaultLocation: string;
  category: string;
}

export const EVENT_TYPES: EventTypeConfig[] = [
  {
    id: "communication-workshop",
    name: "Effective Communication Workshop Series",
    description:
      "Interactive workshop series focused on developing effective communication skills in professional and personal contexts",
    duration: "2 hours",
    maxParticipants: 50,
    defaultLocation: "Conference Room A",
    category: "Professional Development",
  },
];

export const DEFAULT_EVENT_VALUES = {
  // Required fields with sensible defaults
  title: "",
  type: "Effective Communication Workshop Series",
  date: "",
  time: "",
  endTime: "",
  organizer: "",
  purpose: "",
  agenda:
    "Welcome and Introduction\nWorkshop Sessions\nQ&A and Closing Remarks",
  format: "",

  // Optional fields
  hostedBy: "@Cloud Marketplace Ministry",
  location: "Conference Room A",
  disclaimer: "",
  zoomLink: "",
  meetingId: "",
  passcode: "",
  requirements: "",
  materials: "",

  // System fields (optional/auto-generated)
  id: "",
  description: "",
  category: "Professional Development",
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
