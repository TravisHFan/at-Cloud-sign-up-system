import { describe, it, expect } from "vitest";
import { getParticipantAllowedRoleNames } from "../../utils/participantRoles";

describe("getParticipantAllowedRoleNames", () => {
  it("returns participant roles for non-workshop events", () => {
    const names = getParticipantAllowedRoleNames({
      id: "e1",
      title: "Community Event",
      type: "Hybrid Service",
      roles: [],
    } as any);
    expect(names).toEqual([
      "Prepared Speaker (on-site)",
      "Prepared Speaker (Zoom)",
      "Common Participant (on-site)",
      "Common Participant (Zoom)",
    ]);
  });

  it("returns group roles for Effective Communication Workshop", () => {
    const names = getParticipantAllowedRoleNames({
      id: "e2",
      title: "EC Workshop",
      type: "Effective Communication Workshop",
      roles: [],
    } as any);
    expect(names).toContain("Group A Participants");
    expect(names).toContain("Group F Participants");
    // Sanity size check (1 name per group, 6 groups)
    expect(names.length).toBe(6);
  });

  it("returns Webinar breakout lead roles for Webinar events", () => {
    const names = getParticipantAllowedRoleNames({
      id: "e3",
      title: "Webinar",
      type: "Webinar",
      roles: [],
    } as any);
    expect(names).toEqual([
      "Breakout Room Leads for E Circle",
      "Breakout Room Leads for M Circle",
      "Breakout Room Leads for B Circle",
      "Breakout Room Leads for A Circle",
    ]);
  });
});
