import { describe, it, expect } from "vitest";
import { getParticipantAllowedRoleNames } from "../../utils/participantRoles";

describe("participantRoles Mentor Circle", () => {
  it("returns Attendee for Mentor Circle events", () => {
    const roles = getParticipantAllowedRoleNames({
      id: "e1",
      title: "Mentor Circle Event",
      type: "Mentor Circle",
      date: "2025-09-15",
      endDate: "2025-09-15",
      time: "10:00",
      endTime: "11:00",
      location: "HQ",
      organizer: "Org",
      purpose: "",
      format: "In-person",
      disclaimer: "",
      roles: [],
      isHybrid: false,
      flyerUrl: undefined,
      workshopGroupTopics: undefined,
      timeZone: undefined,
    } as any);
    expect(roles).toEqual(["Attendee"]);
  });
});
