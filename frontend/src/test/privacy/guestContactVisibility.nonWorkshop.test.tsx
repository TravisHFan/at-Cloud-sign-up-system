import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventRoleSignup from "../../components/events/EventRoleSignup";

vi.mock("../../components/common/NameCardActionModal", () => ({
  __esModule: true,
  default: () => null,
}));

const role = {
  id: "r1",
  name: "Common Participant (on-site)",
  description: "",
  maxParticipants: 5,
  currentSignups: [],
};

const guest = {
  id: "g1",
  fullName: "Guest Two",
  email: "guest2@example.com",
  phone: "+1 555 0002",
};

const baseProps: any = {
  role,
  onSignup: () => {},
  onCancel: () => {},
  currentUserId: "viewer",
  isUserSignedUpForThisRole: false,
  hasReachedMaxRoles: false,
  maxRolesForUser: 1,
  isRoleAllowedForUser: true,
  eventType: "Seminar",
  guestList: [guest],
};

describe("Guest contact visibility - non-workshop types", () => {
  it("Super Admin sees contact", () => {
    const { getByText } = render(
      <MemoryRouter>
        <EventRoleSignup {...baseProps} currentUserRole="Super Admin" />
      </MemoryRouter>
    );
    expect(getByText("guest2@example.com")).toBeTruthy();
    expect(getByText("+1 555 0002")).toBeTruthy();
  });

  it("Administrator sees contact", () => {
    const { getByText } = render(
      <MemoryRouter>
        <EventRoleSignup {...baseProps} currentUserRole="Administrator" />
      </MemoryRouter>
    );
    expect(getByText("guest2@example.com")).toBeTruthy();
    expect(getByText("+1 555 0002")).toBeTruthy();
  });

  it("Organizer sees contact", () => {
    const { getByText } = render(
      <MemoryRouter>
        <EventRoleSignup
          {...baseProps}
          currentUserRole="Participant"
          isOrganizer
        />
      </MemoryRouter>
    );
    expect(getByText("guest2@example.com")).toBeTruthy();
    expect(getByText("+1 555 0002")).toBeTruthy();
  });

  it("Participant now SEES contact (simplified visibility)", () => {
    // Previously, Participants couldn't see guest contacts
    // Now with simplified logic, all logged-in users can see contacts
    const { getByText } = render(
      <MemoryRouter>
        <EventRoleSignup {...baseProps} currentUserRole="Participant" />
      </MemoryRouter>
    );
    expect(getByText("guest2@example.com")).toBeTruthy();
    expect(getByText("+1 555 0002")).toBeTruthy();
  });
});
