import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import MyEventListItem from "../../components/events/MyEventListItem";
import type { MyEventItemData } from "../../types/myEvents";

const baseItem: MyEventItemData = {
  event: {
    id: "e-my-1",
    title: "Overnight Retreat (My Events)",
    date: "2025-08-16",
    endDate: "2025-08-17",
    time: "21:00",
    // endTime intentionally omitted to reproduce the case under test
    location: "Retreat Lodge",
    format: "In-person",
    status: "scheduled",
    type: "Retreat",
    organizer: "Org Team",
    timeZone: "America/New_York",
    createdAt: new Date().toISOString(),
  },
  registrations: [
    {
      id: "r1",
      roleId: "role-1",
      roleName: "Participant",
      registrationDate: new Date("2024-06-01T12:00:00Z").toISOString(),
      status: "active",
    },
  ],
  isPassedEvent: false,
  eventStatus: "upcoming",
};

describe("MyEventListItem - multi-day without endTime", () => {
  it("shows only the start date+time (no range) when endTime is missing", () => {
    render(
      <BrowserRouter>
        <MyEventListItem item={baseItem} />
      </BrowserRouter>
    );

    // The formatter should not render a range separator when endTime is missing
    expect(screen.queryByText(/\s-\s/)).toBeNull();

    // The start side should look like a full date-time (weekday, month)
    // Example: "Sat, Aug" in en-US locale
    expect(screen.getByText(/\b\w{3},\s\w{3}\b/)).toBeInTheDocument();

    // And because a timeZone is provided, the helper note should appear
    expect(
      screen.getByText(/\(shown in your local time\)/i)
    ).toBeInTheDocument();
  });
});
