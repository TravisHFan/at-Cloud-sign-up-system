import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import GuestRegistration from "../../pages/GuestRegistration";

// Mock the GuestEventSignup component
vi.mock("../../components/events/GuestEventSignup", () => ({
  default: ({ eventId, roleId, perspective }: any) => (
    <div data-testid="guest-event-signup">
      <div>Event ID: {eventId}</div>
      <div>Role ID: {roleId}</div>
      <div>Perspective: {perspective}</div>
    </div>
  ),
}));

describe("GuestRegistration - Organizer Invitation Flow", () => {
  it("renders signup form when roleId is provided (organizer invitation)", () => {
    render(
      <MemoryRouter
        initialEntries={["/guest-register/event123?roleId=role456"]}
      >
        <Routes>
          <Route path="/guest-register/:id" element={<GuestRegistration />} />
        </Routes>
      </MemoryRouter>
    );

    // Should show the "Invite a Guest" header
    expect(screen.getByText("Invite a Guest")).toBeInTheDocument();
    expect(
      screen.getByText("Register a guest for this event - no account required")
    ).toBeInTheDocument();

    // Should render the GuestEventSignup component with correct props
    const signup = screen.getByTestId("guest-event-signup");
    expect(signup).toBeInTheDocument();
    expect(screen.getByText("Event ID: event123")).toBeInTheDocument();
    expect(screen.getByText("Role ID: role456")).toBeInTheDocument();
    expect(screen.getByText("Perspective: inviter")).toBeInTheDocument();
  });

  it("shows invalid access message when no roleId is provided", () => {
    render(
      <MemoryRouter initialEntries={["/guest-register/event123"]}>
        <Routes>
          <Route path="/guest-register/:id" element={<GuestRegistration />} />
        </Routes>
      </MemoryRouter>
    );

    // Should show the invalid access message
    expect(screen.getByText("Invalid Access")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This page can only be accessed through organizer invitations. For guest self-registration, please visit the public event pages."
      )
    ).toBeInTheDocument();

    // Should show navigation buttons
    expect(screen.getByText("Browse Public Events")).toBeInTheDocument();
    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();

    // Should NOT show the GuestEventSignup component
    expect(screen.queryByTestId("guest-event-signup")).not.toBeInTheDocument();
  });

  it("shows event not found message when no event ID is provided", () => {
    render(
      <MemoryRouter initialEntries={["/guest-register"]}>
        <Routes>
          <Route path="/guest-register/:id?" element={<GuestRegistration />} />
        </Routes>
      </MemoryRouter>
    );

    // Should show the event not found message
    expect(screen.getByText("Event Not Found")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We couldn't find the event you're looking for. Please check your link and try again."
      )
    ).toBeInTheDocument();

    // Should show go back button
    expect(screen.getByText("Go Back")).toBeInTheDocument();

    // Should NOT show the GuestEventSignup component
    expect(screen.queryByTestId("guest-event-signup")).not.toBeInTheDocument();
  });
});
