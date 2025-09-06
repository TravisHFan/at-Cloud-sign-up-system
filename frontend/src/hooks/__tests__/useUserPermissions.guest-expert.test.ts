import { describe, it, expect, vi } from "vitest";
import { useUserPermissions } from "../useUserPermissions";
import type { SystemAuthorizationLevel, User } from "../../types/management";
import { renderHook } from "@testing-library/react";

function makeUser(
  role: SystemAuthorizationLevel,
  overrides: Partial<User> = {}
): User {
  return {
    id: "u1",
    username: "user1",
    firstName: "First",
    lastName: "Last",
    email: "first@example.com",
    role,
    isAtCloudLeader: "No",
    joinDate: new Date().toISOString(),
    gender: "male",
    isActive: true,
    ...overrides,
  } as User;
}

describe("useUserPermissions - Guest Expert actions", () => {
  it("Super Admin: shows promote to Guest Expert from Participant and demote to Guest Expert flows", () => {
    const onPromote = vi.fn();
    const onDemote = vi.fn();
    const { result } = renderHook(
      ({ role }: { role: SystemAuthorizationLevel }) =>
        useUserPermissions(
          role,
          onPromote,
          onDemote,
          vi.fn(),
          vi.fn(),
          vi.fn()
        ),
      { initialProps: { role: "Super Admin" as SystemAuthorizationLevel } }
    );

    // Participant target
    const participant = makeUser("Participant");
    let actions = result.current.getActionsForUser(participant);
    const labels = actions.map((a) => a.label);
    expect(labels).toContain("Promote to Guest Expert");
    expect(labels).toContain("Promote to Leader");

    // Leader target -> includes demote to Guest Expert
    const leader = makeUser("Leader");
    actions = result.current.getActionsForUser(leader);
    const leaderLabels = actions.map((a) => a.label);
    expect(leaderLabels).toContain("Demote to Guest Expert");

    // Administrator target -> includes demote to Guest Expert
    const admin = makeUser("Administrator");
    actions = result.current.getActionsForUser(admin);
    const adminLabels = actions.map((a) => a.label);
    expect(adminLabels).toContain("Demote to Guest Expert");

    // Guest Expert target -> includes promote to Leader and demote to Participant
    const guest = makeUser("Guest Expert");
    actions = result.current.getActionsForUser(guest);
    const guestLabels = actions.map((a) => a.label);
    expect(guestLabels).toContain("Promote to Leader");
    expect(guestLabels).toContain("Demote to Participant");
  });

  it("Administrator: can promote Participant->Guest Expert or Leader, Guest Expert->Leader; can demote Leader->Guest Expert and Participant", () => {
    const onPromote = vi.fn();
    const onDemote = vi.fn();
    const { result } = renderHook(() =>
      useUserPermissions(
        "Administrator",
        onPromote,
        onDemote,
        vi.fn(),
        vi.fn(),
        vi.fn()
      )
    );

    // Participant target
    let actions = result.current.getActionsForUser(makeUser("Participant"));
    let labels = actions.map((a) => a.label);
    expect(labels).toContain("Promote to Guest Expert");
    expect(labels).toContain("Promote to Leader");

    // Guest Expert target -> promote to Leader and demote to Participant
    actions = result.current.getActionsForUser(makeUser("Guest Expert"));
    labels = actions.map((a) => a.label);
    expect(labels).toContain("Promote to Leader");
    expect(labels).toContain("Demote to Participant");

    // Leader target -> demote to Guest Expert and Participant
    actions = result.current.getActionsForUser(makeUser("Leader"));
    labels = actions.map((a) => a.label);
    expect(labels).toContain("Demote to Guest Expert");
    expect(labels).toContain("Demote to Participant");
  });
});
