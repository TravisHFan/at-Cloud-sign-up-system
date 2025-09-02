import { describe, it, expect } from "vitest";
import {
  CONFERENCE_ROLES,
  WORKSHOP_ROLES,
} from "../../../src/config/eventTemplates";

function getRoleMax(
  roles: { name: string; maxParticipants: number }[],
  name: string
) {
  const r = roles.find((x) => x.name === name);
  if (!r) throw new Error(`Role not found: ${name}`);
  return r.maxParticipants;
}

describe("Event template defaults", () => {
  it("Conference: Zoom Co-host and Meeting Timer default to 1", () => {
    expect(getRoleMax(CONFERENCE_ROLES, "Zoom Co-host")).toBe(1);
    expect(getRoleMax(CONFERENCE_ROLES, "Meeting Timer")).toBe(1);
  });

  it("Effective Communication Workshop: Zoom Co-host and Meeting Timer default to 1", () => {
    expect(getRoleMax(WORKSHOP_ROLES, "Zoom Co-host")).toBe(1);
    expect(getRoleMax(WORKSHOP_ROLES, "Meeting Timer")).toBe(1);
  });
});
