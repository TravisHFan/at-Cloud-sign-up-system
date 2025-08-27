import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../../services/api", () => ({
  apiClient: {
    getEvent: vi.fn(),
  },
}));

import { apiClient } from "../../services/api";
import GuestRegistration from "../../pages/GuestRegistration";

describe("GuestRegistration organizer contact display", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const renderGuestRegistration = (eventData: any) => {
    (apiClient.getEvent as any).mockResolvedValue(eventData);
    return render(
      <MemoryRouter initialEntries={[`/guest-register/${eventData.id}`]}>
        <Routes>
          <Route path="/guest-register/:id" element={<GuestRegistration />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("always shows placeholder text on guest registration even when organizerDetails are provided", async () => {
    const event = {
      id: "event-with-organizers",
      title: "Test Event with Organizers",
      type: "Conference",
      date: "2025-01-15",
      endDate: "2025-01-15",
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      organizer: "Test Organizer",
      purpose: "Test purpose for the event",
      agenda: "Test agenda for the event",
      format: "In-person",
      organizerDetails: [
        {
          userId: "user-123",
          name: "Alice Johnson",
          role: "Event Coordinator",
          email: "alice.johnson@example.com",
          phone: "+1-555-0123",
          avatar: null,
          gender: "female",
        },
        {
          userId: "user-456",
          name: "Bob Smith",
          role: "Technical Lead",
          email: "bob.smith@example.com",
          phone: "+1-555-0456",
          avatar: "https://example.com/avatar.jpg",
          gender: "male",
        },
      ],
      roles: [
        {
          id: "role-1",
          name: "Common Participant (on-site)",
          description: "Standard participant role",
          maxParticipants: 50,
          currentSignups: [],
        },
      ],
    };

    renderGuestRegistration(event);

    // Wait for the event to load and verify organizer contact section exists
    await waitFor(() => {
      expect(screen.getByText("Organizer Contact")).toBeInTheDocument();
    });

    // Should show placeholder text and not reveal organizerDetails
    expect(
      screen.getByText(
        "Contact information will be provided upon registration."
      )
    ).toBeInTheDocument();

    // Organizer summary name from event.organizer should be visible
    expect(screen.getByText("Test Organizer")).toBeInTheDocument();

    // Co-organizer details should NOT be visible
    expect(screen.queryByText("Alice Johnson")).not.toBeInTheDocument();
    expect(screen.queryByText("Event Coordinator")).not.toBeInTheDocument();
    expect(screen.queryByText("Bob Smith")).not.toBeInTheDocument();
    expect(screen.queryByText("Technical Lead")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "alice.johnson@example.com" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "+1-555-0123" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "bob.smith@example.com" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "+1-555-0456" })
    ).not.toBeInTheDocument();
  });

  it("shows fallback message when no organizerDetails are provided", async () => {
    const event = {
      id: "event-no-organizers",
      title: "Test Event without Organizers",
      type: "Conference",
      date: "2025-01-15",
      endDate: "2025-01-15",
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      organizer: "Fallback Organizer Name",
      purpose: "Test purpose for the event",
      agenda: "Test agenda for the event",
      format: "In-person",
      organizerDetails: [], // Empty array
      roles: [
        {
          id: "role-1",
          name: "Common Participant (on-site)",
          description: "Standard participant role",
          maxParticipants: 50,
          currentSignups: [],
        },
      ],
    };

    renderGuestRegistration(event);

    // Wait for the event to load and verify organizer contact section exists
    await waitFor(() => {
      expect(screen.getByText("Organizer Contact")).toBeInTheDocument();
    });

    // Check that fallback message is displayed
    expect(
      screen.getByText(
        "Contact information will be provided upon registration."
      )
    ).toBeInTheDocument();

    // Ensure organizer name is displayed from the organizer field
    expect(screen.getByText("Fallback Organizer Name")).toBeInTheDocument();
  });

  it("shows fallback message when organizerDetails is undefined", async () => {
    const event = {
      id: "event-undefined-organizers",
      title: "Test Event with undefined organizerDetails",
      type: "Conference",
      date: "2025-01-15",
      endDate: "2025-01-15",
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      organizer: "Fallback Organizer",
      purpose: "Test purpose for the event",
      agenda: "Test agenda for the event",
      format: "In-person",
      // organizerDetails: undefined (not set)
      roles: [
        {
          id: "role-1",
          name: "Common Participant (on-site)",
          description: "Standard participant role",
          maxParticipants: 50,
          currentSignups: [],
        },
      ],
    };

    renderGuestRegistration(event);

    // Wait for the event to load and verify organizer contact section exists
    await waitFor(() => {
      expect(screen.getByText("Organizer Contact")).toBeInTheDocument();
    });

    // Check that fallback message is displayed
    expect(
      screen.getByText(
        "Contact information will be provided upon registration."
      )
    ).toBeInTheDocument();
  });

  it("still shows placeholder when organizerDetails contain mixed data", async () => {
    const event = {
      id: "event-mixed-organizers",
      title: "Test Event with Mixed Organizer Data",
      type: "Conference",
      date: "2025-01-15",
      endDate: "2025-01-15",
      time: "10:00",
      endTime: "12:00",
      location: "Test Location",
      organizer: "Main Organizer",
      purpose: "Test purpose for the event",
      agenda: "Test agenda for the event",
      format: "In-person",
      organizerDetails: [
        {
          userId: "user-123",
          name: "Valid Organizer",
          role: "Event Lead",
          email: "valid@example.com",
          phone: "+1-555-0789",
          avatar: null,
          gender: "female",
        },
        {
          // Missing userId - should still display
          name: "Organizer Without UserId",
          role: "Co-organizer",
          email: "nouserid@example.com",
          phone: "+1-555-0999",
          avatar: null,
          gender: "male",
        },
      ],
      roles: [
        {
          id: "role-1",
          name: "Common Participant (on-site)",
          description: "Standard participant role",
          maxParticipants: 50,
          currentSignups: [],
        },
      ],
    };

    renderGuestRegistration(event);

    // Wait for the event to load
    await waitFor(() => {
      expect(screen.getByText("Organizer Contact")).toBeInTheDocument();
    });

    // Placeholder text should be shown
    expect(
      screen.getByText(
        "Contact information will be provided upon registration."
      )
    ).toBeInTheDocument();
    // Organizer label should be shown
    expect(screen.getByText("Main Organizer")).toBeInTheDocument();
    // No individual organizer details should be revealed
    expect(screen.queryByText("Valid Organizer")).not.toBeInTheDocument();
    expect(screen.queryByText("Event Lead")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Organizer Without UserId")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Co-organizer")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "valid@example.com" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "+1-555-0789" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "nouserid@example.com" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "+1-555-0999" })
    ).not.toBeInTheDocument();
  });
});
