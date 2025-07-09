import type { EventRole } from "../types/event";

export const COMMUNICATION_WORKSHOP_ROLES: Omit<
  EventRole,
  "id" | "currentSignups"
>[] = [
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
    maxParticipants: 3,
  },
  {
    name: "Meeting Timer",
    description: "Tracks time, alerts MC (e.g., buzzer)",
    maxParticipants: 2,
  },
  {
    name: "Practice Group Director (on-site)",
    description: "Guides breakout room discussions, answers questions",
    maxParticipants: 0, // Set by event creator
  },
  {
    name: "Practice Group Director (Zoom)",
    description: "Guides breakout room discussions, answers questions",
    maxParticipants: 0, // Set by event creator
  },
  {
    name: "Prepared Speaker (on-site)",
    description: "Speakers for practice groups",
    maxParticipants: 0, // Set by event creator
  },
  {
    name: "Prepared Speaker (Zoom)",
    description: "Speakers for practice groups",
    maxParticipants: 0, // Set by event creator
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
