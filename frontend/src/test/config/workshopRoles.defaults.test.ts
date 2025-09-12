import { describe, it, expect } from "vitest";
import {
  getRolesByEventType,
  COMMUNICATION_WORKSHOP_ROLES,
} from "../../config/eventRoles";

function getRoleMax(
  roles: { name: string; maxParticipants: number }[],
  name: string
) {
  const r = roles.find((x) => x.name === name);
  if (!r) throw new Error(`Role not found: ${name}`);
  return r.maxParticipants;
}

describe("Workshop role defaults", () => {
  it("Effective Communication Workshop: updated default max values", () => {
    const roles = getRolesByEventType("Effective Communication Workshop");
    expect(getRoleMax(roles, "Zoom Co-host")).toBe(2);
    expect(getRoleMax(roles, "Spiritual Adviser")).toBe(2);
    expect(getRoleMax(roles, "Opening Keynote Speaker")).toBe(2);
    expect(getRoleMax(roles, "Evaluators")).toBe(5);
    expect(getRoleMax(roles, "Closing Keynote Speaker")).toBe(2);
    expect(getRoleMax(roles, "Meeting Timer")).toBe(1); // unchanged
  });

  it("Conference defaults (COMMUNICATION_WORKSHOP_ROLES): Zoom Co-host and Meeting Timer default to 1", () => {
    expect(getRoleMax(COMMUNICATION_WORKSHOP_ROLES, "Zoom Co-host")).toBe(1);
    expect(getRoleMax(COMMUNICATION_WORKSHOP_ROLES, "Meeting Timer")).toBe(1);
  });
});
