import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EventListItem from "../../components/events/EventListItem";
import type { EventData } from "../../types/event";

describe("EventListItem - Ongoing badge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows 'Ongoing' label when current time is between start and end", () => {
    // Freeze time to a fixed point
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-08-15T12:00:00")); // local time

    const event: EventData = {
      id: "evt-ongoing-1",
      title: "Midday Workshop",
      type: "Workshop",
      date: "2025-08-15",
      time: "11:00", // started an hour ago
      endTime: "13:00", // ends in one hour
      location: "Room 101",
      organizer: "Org Team",
      purpose: "Learning",
      roles: [],
      signedUp: 3,
      totalSlots: 10,
      createdBy: "u1",
      createdAt: new Date().toISOString(),
      format: "In-person",
    };

    render(
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <EventListItem event={event} type="upcoming" />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    // Ongoing badge should be visible
    expect(screen.getByText(/Ongoing/i)).toBeInTheDocument();
  });
});
