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

  it("displays organizer contact information when organizerDetails are provided", async () => {
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

    // Check that both organizers are displayed
    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.getByText("Event Coordinator")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.getByText("Technical Lead")).toBeInTheDocument();

    // Check that contact information is displayed as clickable links
    const aliceEmail = screen.getByRole("link", {
      name: "alice.johnson@example.com",
    });
    expect(aliceEmail).toBeInTheDocument();
    expect(aliceEmail).toHaveAttribute(
      "href",
      "mailto:alice.johnson@example.com"
    );

    const alicePhone = screen.getByRole("link", { name: "+1-555-0123" });
    expect(alicePhone).toBeInTheDocument();
    expect(alicePhone).toHaveAttribute("href", "tel:+1-555-0123");

    const bobEmail = screen.getByRole("link", {
      name: "bob.smith@example.com",
    });
    expect(bobEmail).toBeInTheDocument();
    expect(bobEmail).toHaveAttribute("href", "mailto:bob.smith@example.com");

    const bobPhone = screen.getByRole("link", { name: "+1-555-0456" });
    expect(bobPhone).toBeInTheDocument();
    expect(bobPhone).toHaveAttribute("href", "tel:+1-555-0456");
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

  it("handles mixed valid and invalid organizer data gracefully", async () => {
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

    // Both organizers should be displayed
    expect(screen.getByText("Valid Organizer")).toBeInTheDocument();
    expect(screen.getByText("Event Lead")).toBeInTheDocument();
    expect(screen.getByText("Organizer Without UserId")).toBeInTheDocument();
    expect(screen.getByText("Co-organizer")).toBeInTheDocument();

    // Contact information should be displayed for both
    expect(
      screen.getByRole("link", { name: "valid@example.com" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "+1-555-0789" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "nouserid@example.com" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "+1-555-0999" })
    ).toBeInTheDocument();
  });
});
