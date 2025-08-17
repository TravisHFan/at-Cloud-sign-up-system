import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EventListItem from "../../components/events/EventListItem";
import type { EventData } from "../../types/event";

const baseEvent: EventData = {
  id: "e1",
  title: "Overnight Retreat",
  type: "Retreat",
  date: "2025-08-10",
  endDate: "2025-08-11",
  time: "21:00",
  endTime: "06:00",
  location: "Lodge",
  organizer: "Org Team",
  purpose: "Fellowship",
  roles: [],
  signedUp: 0,
  totalSlots: 10,
  createdBy: "u1",
  createdAt: new Date().toISOString(),
  format: "In-person",
};

describe("EventListItem - endDate rendering", () => {
  it("shows endDate next to start date when different", () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <EventListItem
              event={baseEvent}
              type="upcoming"
              onSignUp={() => {}}
              onViewDetails={() => {}}
            />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    // Should render both start and end dates (American short format includes month/day)
    expect(screen.getByText(/Sun,\s+Aug/i)).toBeInTheDocument();
    expect(screen.getByText(/Mon,\s+Aug/i)).toBeInTheDocument();
  });
});
