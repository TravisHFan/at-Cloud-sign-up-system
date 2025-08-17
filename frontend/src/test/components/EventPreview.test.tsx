import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import EventPreview from "../../components/events/EventPreview";
import type { EventData } from "../../types/event";

vi.mock("../../utils/eventStatsUtils", () => ({
  formatEventDateTimeRangeInViewerTZ: vi.fn(
    () => "Jan 1, 2025, 10:00 AM – Jan 2, 2025, 12:00 PM"
  ),
}));

const baseEvent: EventData = {
  id: "preview",
  title: "Preview Multi-day",
  type: "Conference",
  date: "2025-01-01",
  endDate: "2025-01-02",
  time: "10:00",
  endTime: "12:00",
  timeZone: "America/Los_Angeles",
  location: "Room 100",
  organizer: "Fallback Organizer",
  hostedBy: "@Cloud Marketplace Ministry",
  purpose: "Purpose text",
  agenda: "Agenda text",
  format: "In-person",
  roles: [],
  signedUp: 0,
  totalSlots: 0,
  createdBy: {
    id: "u-main",
    firstName: "Main",
    lastName: "Owner",
    email: "main@example.com",
    role: "Administrator",
    roleInAtCloud: "Administrator",
    gender: "female",
  },
  createdAt: new Date().toISOString(),
  organizerDetails: [
    {
      userId: "u-co1",
      name: "Alice Alpha",
      role: "Leader",
      email: "a@example.com",
      phone: "555-2222",
      avatar: null,
      gender: "female",
    },
    {
      userId: "u-co2",
      name: "Bob Beta",
      role: "Administrator",
      email: "b@example.com",
      phone: "555-3333",
      avatar: null,
      gender: "male",
    },
  ],
};

describe("EventPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows unified date-time range, organizer and co-organizers", () => {
    render(
      <EventPreview
        eventData={baseEvent}
        isSubmitting={false}
        onEdit={() => {}}
        onSubmit={() => {}}
      />
    );

    // Header
    expect(screen.getByText(/Event Preview/)).toBeInTheDocument();

    // Unified date-time range (mocked)
    expect(
      screen.getByText("Jan 1, 2025, 10:00 AM – Jan 2, 2025, 12:00 PM", {
        exact: false,
      })
    ).toBeInTheDocument();

    // Local time hint
    expect(screen.getByText(/shown in your local time/i)).toBeInTheDocument();

    // Organizer separation
    expect(screen.getByText(/^Organizer$/)).toBeInTheDocument();
    expect(screen.getByText(/Main Owner/)).toBeInTheDocument();
    expect(screen.getByText(/^Co-organizers$/)).toBeInTheDocument();
    expect(screen.getByText("Alice Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bob Beta")).toBeInTheDocument();
  });
});
