interface EventTypeConfig {
  id: string;
  name: string;
  description: string;
  duration: string;
  maxParticipants: number;
  defaultLocation: string;
}

export const EVENT_TYPES: EventTypeConfig[] = [
  {
    id: "conference",
    name: "Conference",
    description: "Large-scale conference event",
    duration: "1 day",
    maxParticipants: 100,
    defaultLocation: "Main Auditorium",
  },
  {
    id: "mentor-circle",
    name: "Mentor Circle",
    description: "Mentorship-focused small group with mentors and mentees",
    duration: "2 hours",
    maxParticipants: 32,
    defaultLocation: "Training Room",
  },
  {
    id: "webinar",
    name: "Webinar",
    description: "Online seminar with structured roles and breakout rooms",
    duration: "90 minutes",
    maxParticipants: 200,
    defaultLocation: "Online",
  },
  {
    id: "workshop",
    name: "Effective Communication Workshop",
    description: "Hands-on workshop featuring mentors and grouped activities",
    duration: "3 hours",
    maxParticipants: 40,
    defaultLocation: "Workshop Space",
  },
];

export const DEFAULT_EVENT_VALUES = {
  // Required fields with sensible defaults
  title: "",
  type: "", // Let user choose event type explicitly
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
  location: "Main Auditorium",
  disclaimer: "",
  zoomLink: "",
  meetingId: "",
  passcode: "",
  requirements: "",
  materials: "",
  timeZone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone ||
        "America/Los_Angeles"
      : "America/Los_Angeles",

  // System fields (optional/auto-generated)
  id: "",
  description: "",
  isHybrid: false,
  roles: [],
  signedUp: 0,
  totalSlots: 50,
  createdBy: "",
  createdAt: "",
  flyerUrl: "",
  secondaryFlyerUrl: "",
};

export type EventType = (typeof EVENT_TYPES)[number];
export type EventTypeId = EventType["id"];
