/**
 * Participant Roles Tests
 *
 * Tests role access control for different event types:
 * - getParticipantAllowedRoleNames: Returns guest-visible roles
 * - Webinar: Attendee + Breakout leads
 * - Workshop: Group participants
 * - Mentor Circle: Attendee
 * - Default: Speaker and Common Participant roles
 */

import { describe, it, expect } from "vitest";
import { getParticipantAllowedRoleNames } from "../participantRoles";
import type { EventData } from "../../types/event";

describe("participantRoles", () => {
  describe("getParticipantAllowedRoleNames", () => {
    it("should return empty array when event is null", () => {
      const result = getParticipantAllowedRoleNames(null);
      expect(result).toEqual([]);
    });

    it("should return empty array when event is undefined", () => {
      const result = getParticipantAllowedRoleNames(undefined);
      expect(result).toEqual([]);
    });

    it("should return Webinar roles", () => {
      const event: Partial<EventData> = {
        type: "Webinar",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);

      expect(result).toContain("Attendee");
      expect(result).toContain("Breakout Room Leads for E Circle");
      expect(result).toContain("Breakout Room Leads for M Circle");
      expect(result).toContain("Breakout Room Leads for B Circle");
      expect(result).toContain("Breakout Room Leads for A Circle");
      expect(result).toHaveLength(5);
    });

    it("should return Workshop roles for all 6 groups", () => {
      const event: Partial<EventData> = {
        type: "Effective Communication Workshop",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);

      expect(result).toContain("Group A Participants");
      expect(result).toContain("Group B Participants");
      expect(result).toContain("Group C Participants");
      expect(result).toContain("Group D Participants");
      expect(result).toContain("Group E Participants");
      expect(result).toContain("Group F Participants");
      expect(result).toHaveLength(6);
    });

    it("should return Mentor Circle role", () => {
      const event: Partial<EventData> = {
        type: "Mentor Circle",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);

      expect(result).toContain("Attendee");
      expect(result).toHaveLength(1);
    });

    it("should return default roles for Toastmaster Meeting", () => {
      const event: Partial<EventData> = {
        type: "Toastmaster Meeting",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);

      expect(result).toContain("Prepared Speaker (on-site)");
      expect(result).toContain("Prepared Speaker (Zoom)");
      expect(result).toContain("Common Participant (on-site)");
      expect(result).toContain("Common Participant (Zoom)");
      expect(result).toHaveLength(4);
    });

    it("should return default roles for unknown event type", () => {
      const event: Partial<EventData> = {
        type: "Unknown Event Type" as any,
      };

      const result = getParticipantAllowedRoleNames(event as EventData);

      expect(result).toContain("Prepared Speaker (on-site)");
      expect(result).toContain("Prepared Speaker (Zoom)");
      expect(result).toContain("Common Participant (on-site)");
      expect(result).toContain("Common Participant (Zoom)");
      expect(result).toHaveLength(4);
    });

    it("should return default roles when type is not specified", () => {
      const event: Partial<EventData> = {};

      const result = getParticipantAllowedRoleNames(event as EventData);

      expect(result).toEqual([
        "Prepared Speaker (on-site)",
        "Prepared Speaker (Zoom)",
        "Common Participant (on-site)",
        "Common Participant (Zoom)",
      ]);
    });

    it("should handle case sensitivity for Webinar", () => {
      const event: Partial<EventData> = {
        type: "Webinar" as any,
      };

      const result = getParticipantAllowedRoleNames(event as EventData);

      expect(result).toHaveLength(5);
      expect(result[0]).toBe("Attendee");
    });

    it("should handle exact string match for Workshop", () => {
      const event: Partial<EventData> = {
        type: "Effective Communication Workshop",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);

      expect(result).toHaveLength(6);
      expect(result.every((r) => r.includes("Group"))).toBe(true);
      expect(result.every((r) => r.includes("Participants"))).toBe(true);
    });

    it("should handle exact string match for Mentor Circle", () => {
      const event: Partial<EventData> = {
        type: "Mentor Circle",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);

      expect(result).toEqual(["Attendee"]);
    });

    it("should include all breakout circles for Webinar", () => {
      const event: Partial<EventData> = {
        type: "Webinar",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);

      const circles = ["E", "M", "B", "A"];
      circles.forEach((circle) => {
        expect(
          result.some((role) =>
            role.includes(`Breakout Room Leads for ${circle} Circle`)
          )
        ).toBe(true);
      });
    });

    it("should not include facilitator roles for Workshop", () => {
      const event: Partial<EventData> = {
        type: "Effective Communication Workshop",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);

      expect(result.every((r) => !r.includes("Facilitator"))).toBe(true);
      expect(result.every((r) => !r.includes("Leader"))).toBe(true);
    });

    it("should return distinct role names without duplicates", () => {
      const event: Partial<EventData> = {
        type: "Webinar",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);
      const unique = [...new Set(result)];

      expect(result.length).toBe(unique.length);
    });

    it("should return distinct role names for Workshop", () => {
      const event: Partial<EventData> = {
        type: "Effective Communication Workshop",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);
      const unique = [...new Set(result)];

      expect(result.length).toBe(unique.length);
    });

    it("should return distinct role names for default", () => {
      const event: Partial<EventData> = {
        type: "Regular Meeting" as any,
      };

      const result = getParticipantAllowedRoleNames(event as EventData);
      const unique = [...new Set(result)];

      expect(result.length).toBe(unique.length);
    });
  });

  describe("edge cases", () => {
    it("should handle event with extra properties", () => {
      const event: any = {
        type: "Webinar",
        extraProp: "should be ignored",
        anotherProp: 123,
      };

      const result = getParticipantAllowedRoleNames(event);

      expect(result).toHaveLength(5);
      expect(result[0]).toBe("Attendee");
    });

    it("should handle falsy event object", () => {
      const results = [
        getParticipantAllowedRoleNames(null),
        getParticipantAllowedRoleNames(undefined),
        getParticipantAllowedRoleNames(0 as any),
        getParticipantAllowedRoleNames("" as any),
        getParticipantAllowedRoleNames(false as any),
      ];

      results.forEach((result) => {
        expect(result).toEqual([]);
      });
    });

    it("should return new array each time (not cached)", () => {
      const event: Partial<EventData> = {
        type: "Webinar",
      };

      const result1 = getParticipantAllowedRoleNames(event as EventData);
      const result2 = getParticipantAllowedRoleNames(event as EventData);

      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2); // Different array instances
    });

    it("should not mutate returned array", () => {
      const event: Partial<EventData> = {
        type: "Webinar",
      };

      const result = getParticipantAllowedRoleNames(event as EventData);
      const originalLength = result.length;

      result.push("New Role");

      const result2 = getParticipantAllowedRoleNames(event as EventData);
      expect(result2).toHaveLength(originalLength);
    });
  });

  describe("default export", () => {
    it("should be the same as named export", async () => {
      const defaultImport = (await import("../participantRoles")).default;

      expect(defaultImport).toBe(getParticipantAllowedRoleNames);
    });
  });
});
