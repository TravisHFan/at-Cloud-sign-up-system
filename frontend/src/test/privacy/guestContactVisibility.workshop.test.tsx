import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventRoleSignup from "../../components/events/EventRoleSignup";

vi.mock("../../components/common/NameCardActionModal", () => ({
  __esModule: true,
  default: () => null,
}));

const baseRole = (name: string) => ({
  id: "r1",
  name,
  description: "",
  maxParticipants: 5,
  currentSignups: [],
});

const guest = {
  id: "g1",
  fullName: "Guest One",
  email: "guest1@example.com",
  phone: "+1 555 0001",
};

const renderComp = (props: Partial<any> = {}) => {
  const role = props.role || baseRole("Group A Participants");
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
    viewerGroupLetters: ["A" as const],
    guestList: [guest],
    ...props,
  };
  return render(
    <MemoryRouter>
      <EventRoleSignup {...allProps} />
    </MemoryRouter>
  );
};

describe("Guest contact visibility - workshop and others", () => {
  it("shows guest contact for same-group viewer in Effective Communication Workshop", () => {
    const { getByText } = renderComp();
    expect(getByText("guest1@example.com")).toBeTruthy();
    expect(getByText("+1 555 0001")).toBeTruthy();
  });

  it("hides guest contact for different-group viewer in Effective Communication Workshop", () => {
    const { queryByText } = renderComp({ viewerGroupLetters: ["B"] });
    expect(queryByText("guest1@example.com")).toBeNull();
    expect(queryByText("+1 555 0001")).toBeNull();
  });

  it("shows guest contact for organizers regardless of group in Effective Communication Workshop", () => {
    const { getByText } = renderComp({
      viewerGroupLetters: ["B"],
      isOrganizer: true,
    });
    expect(getByText("guest1@example.com")).toBeTruthy();
    expect(getByText("+1 555 0001")).toBeTruthy();
  });

  it("shows guest contact for Administrator on non-workshop events", () => {
    const { getByText } = renderComp({
      eventType: "Meeting",
      currentUserRole: "Administrator",
      role: baseRole("Common Participant (on-site)"),
    });
    expect(getByText("guest1@example.com")).toBeTruthy();
    expect(getByText("+1 555 0001")).toBeTruthy();
  });

  it("hides guest contact for non-admin non-organizer on non-workshop events", () => {
    const { queryByText } = renderComp({
      eventType: "Meeting",
      role: baseRole("Common Participant (on-site)"),
    });
    expect(queryByText("guest1@example.com")).toBeNull();
    expect(queryByText("+1 555 0001")).toBeNull();
  });
});
