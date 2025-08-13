import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import EventRoleSignup from "../components/events/EventRoleSignup";
vi.mock("../components/common/NameCardActionModal", () => ({
  default: () => null,
}));

const baseParticipant = (over: Partial<any> = {}) => ({
  userId: "u1",
  username: "u1",
  firstName: "U",
  lastName: "One",
  email: "u1@example.com",
  phone: "123",
  systemAuthorizationLevel: "Participant",
  roleInAtCloud: "Member",
  ...over,
});

const renderRole = (props: Partial<any> = {}) => {
  const role = {
    id: "r1",
    name: "Group A Participants",
    description: "",
    maxParticipants: 3,
    currentSignups: [baseParticipant()],
  };
  const allProps = {
    role,
    onSignup: () => {},
    onCancel: () => {},
    currentUserId: "viewer",
    currentUserRole: "Participant" as const,
    isUserSignedUpForThisRole: false,
    hasReachedMaxRoles: false,
    maxRolesForUser: 1,
    isRoleAllowedForUser: true,
    eventType: "Effective Communication Workshop",
    viewerGroupLetter: "A" as const,
    ...props,
  };
  return render(
    <MemoryRouter>
      <AuthProvider>
        <EventRoleSignup {...allProps} />
      </AuthProvider>
    </MemoryRouter>
  );
};

describe("EventRoleSignup contact rendering", () => {
  it("shows contact on same group", () => {
    const { getByText } = renderRole();
    expect(getByText("u1@example.com")).toBeTruthy();
    expect(getByText("123")).toBeTruthy();
  });

  it("hides contact on other group", () => {
    const { queryByText } = renderRole({ viewerGroupLetter: "B" });
    expect(queryByText("u1@example.com")).toBeNull();
    expect(queryByText("123")).toBeNull();
  });
});
