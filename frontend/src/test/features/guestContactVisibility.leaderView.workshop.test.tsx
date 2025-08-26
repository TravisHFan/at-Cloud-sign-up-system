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

describe("Leader same-group visibility in Effective Communication Workshop", () => {
  it("Leader in group A sees contact in group A slot, but not in group B", () => {
    const { getByText, queryByText, rerender } = render(
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
          eventType="Effective Communication Workshop"
          viewerGroupLetters={["A"]}
          guestList={[guest]}
        />
      </MemoryRouter>
    );
    expect(getByText("ga@example.com")).toBeTruthy();
    expect(getByText("+1 555 0101")).toBeTruthy();

    // Now render a Group B slot where leader is not in that group
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
          eventType="Effective Communication Workshop"
          viewerGroupLetters={["A"]}
          guestList={[guest]}
        />
      </MemoryRouter>
    );
    expect(queryByText("ga@example.com")).toBeNull();
    expect(queryByText("+1 555 0101")).toBeNull();
  });
});
