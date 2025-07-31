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
    id: "communication-workshop",
    name: "Effective Communication Workshop Series",
    description:
      "Interactive workshop series focused on developing effective communication skills in professional and personal contexts",
    duration: "2 hours",
    maxParticipants: 50,
    defaultLocation: "Conference Room A",
  },
  {
    id: "weekly-meeting",
    name: "Weekly Meeting",
    description: "Regular weekly meeting for team coordination and updates",
    duration: "1 hour",
    maxParticipants: 30,
    defaultLocation: "Main Conference Room",
  },
  {
    id: "monthly-meeting",
    name: "Monthly Meeting",
    description: "Monthly meeting for strategic planning and reviews",
    duration: "2 hours",
    maxParticipants: 50,
    defaultLocation: "Main Conference Room",
  },
  {
    id: "training-session",
    name: "Training Session",
    description: "Educational training session for skill development",
    duration: "3 hours",
    maxParticipants: 25,
    defaultLocation: "Training Room",
  },
  {
    id: "workshop",
    name: "Workshop",
    description: "Interactive workshop for hands-on learning",
    duration: "4 hours",
    maxParticipants: 20,
    defaultLocation: "Workshop Space",
  },
  {
    id: "conference",
    name: "Conference",
    description: "Large-scale conference event",
    duration: "1 day",
    maxParticipants: 100,
    defaultLocation: "Main Auditorium",
  },
  {
    id: "seminar",
    name: "Seminar",
    description: "Educational seminar presentation",
    duration: "2 hours",
    maxParticipants: 40,
    defaultLocation: "Seminar Room",
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
  isHybrid: false,
  roles: [],
  signedUp: 0,
  totalSlots: 50,
  createdBy: "",
  createdAt: "",
};

export type EventType = (typeof EVENT_TYPES)[number];
export type EventTypeId = EventType["id"];
