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

export const DEFAULT_EVENT_VALUES = {
  isHybrid: false,
  totalSlots: 50,
  title: "",
  description: "",
  date: "",
  time: "",
  location: "",
  category: "",
  requirements: "",
  materials: "",
  zoomLink: "",
} as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];
