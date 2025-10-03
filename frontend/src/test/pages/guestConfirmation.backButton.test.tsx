import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import GuestConfirmation from "../../pages/GuestConfirmation";

describe("GuestConfirmation - Back to Event Page Button", () => {
  it("links to correct dashboard event page for organizer invitation", () => {
    // Mock the location state to indicate organizer invitation
    const mockLocationState = {
      guestRegistration: {
        fullName: "Test Guest",
        email: "test@example.com",
        eventTitle: "Test Event",
        roleName: "Participant",
      },
      isOrganizerInvitation: true,
      eventId: "test-event-123",
    };

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/guest-confirmation", state: mockLocationState },
        ]}
      >
        <Routes>
          <Route path="/guest-confirmation" element={<GuestConfirmation />} />
          <Route
            path="/dashboard/event/:id"
            element={<div>Event Detail Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Find the "Back to Event Page" button
    const backButton = screen.getByText("Back to Event Page");
    expect(backButton).toBeInTheDocument();

    // Check that it links to the correct dashboard event page
    const link = backButton.closest("a");
    expect(link).toHaveAttribute("href", "/dashboard/event/test-event-123");
  });

  it("falls back to dashboard when eventId is missing", () => {
    // Mock sessionStorage to ensure no stored eventId
    const originalSessionStorage = window.sessionStorage;
    window.sessionStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as unknown as Storage;

    const mockLocationState = {
      guestRegistration: {
        fullName: "Test Guest",
        email: "test@example.com",
        eventTitle: "Test Event",
        roleName: "Participant",
      },
      isOrganizerInvitation: true,
      // No eventId provided in state
    };

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/guest-confirmation", state: mockLocationState },
        ]}
      >
        <Routes>
          <Route path="/guest-confirmation" element={<GuestConfirmation />} />
          <Route
            path="/dashboard/upcoming"
            element={<div>Dashboard Upcoming</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Find the "Back to Event Page" button
    const backButton = screen.getByText("Back to Event Page");
    expect(backButton).toBeInTheDocument();

    // Check that it falls back to dashboard when eventId is missing
    const link = backButton.closest("a");
    expect(link).toHaveAttribute("href", "/dashboard/upcoming");

    // Restore original sessionStorage
    window.sessionStorage = originalSessionStorage;
  });

  it("does not show Back to Event Page button for non-organizer invitations", () => {
    const mockLocationState = {
      guestRegistration: {
        fullName: "Test Guest",
        email: "test@example.com",
        eventTitle: "Test Event",
        roleName: "Participant",
      },
      isOrganizerInvitation: false, // Not an organizer invitation
      eventId: "test-event-123",
    };

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/guest-confirmation", state: mockLocationState },
        ]}
      >
        <Routes>
          <Route path="/guest-confirmation" element={<GuestConfirmation />} />
        </Routes>
      </MemoryRouter>
    );

    // Should not show "Back to Event Page" for non-organizer invitations
    expect(screen.queryByText("Back to Event Page")).not.toBeInTheDocument();

    // Should show other buttons instead
    expect(screen.getByText("Browse More Events")).toBeInTheDocument();
    expect(screen.getByText("Return to Login")).toBeInTheDocument();
  });
});
