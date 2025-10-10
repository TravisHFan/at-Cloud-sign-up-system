import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventRoleSignup from "../../components/events/EventRoleSignup";

vi.mock("../../components/common/NameCardActionModal", () => ({
  __esModule: true,
  default: () => null,
}));

const role = {
  id: "rA",
  name: "Group A Leader",
  description: "",
  maxParticipants: 2,
  currentSignups: [],
};

const guest = {
  id: "gA",
  fullName: "Guest A",
  email: "ga@example.com",
  phone: "+1 555 0101",
};

describe("Leader visibility in Effective Communication Workshop - simplified", () => {
  it("Leader sees contact in all groups (no longer group-restricted)", () => {
    const { getByText, rerender } = render(
      <MemoryRouter>
        <EventRoleSignup
          role={role}
          onSignup={() => {}}
          onCancel={() => {}}
          currentUserId="viewer"
          currentUserRole="Leader"
          isUserSignedUpForThisRole={false}
          hasReachedMaxRoles={false}
          maxRolesForUser={1}
          isRoleAllowedForUser={true}
          guestList={[guest]}
        />
      </MemoryRouter>
    );
    // Leader in Group A should see Group A guest contact
    expect(getByText("ga@example.com")).toBeTruthy();
    expect(getByText("+1 555 0101")).toBeTruthy();

    // Now render a Group B slot - leader should ALSO see contact (no longer hidden)
    rerender(
      <MemoryRouter>
        <EventRoleSignup
          role={{ ...role, id: "rB", name: "Group B Participants" }}
          onSignup={() => {}}
          onCancel={() => {}}
          currentUserId="viewer"
          currentUserRole="Leader"
          isUserSignedUpForThisRole={false}
          hasReachedMaxRoles={false}
          maxRolesForUser={1}
          isRoleAllowedForUser={true}
          guestList={[guest]}
        />
      </MemoryRouter>
    );
    // With simplified visibility, leader now sees all contacts
    expect(getByText("ga@example.com")).toBeTruthy();
    expect(getByText("+1 555 0101")).toBeTruthy();
  });
});
