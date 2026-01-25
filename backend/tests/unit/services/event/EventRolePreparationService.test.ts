/**
 * EventRolePreparationService.test.ts
 * Tests for role preparation service branch coverage
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventRolePreparationService } from "../../../../src/services/event/EventRolePreparationService";

// Mock uuid to control generated IDs
vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-1234"),
}));

// Mock validateRoles
vi.mock("../../../../src/utils/event/eventValidation", () => ({
  validateRoles: vi.fn(),
}));

import { validateRoles } from "../../../../src/utils/event/eventValidation";

describe("EventRolePreparationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("prepareRoles", () => {
    it("should return error when role validation fails", () => {
      vi.mocked(validateRoles).mockReturnValue({
        valid: false,
        errors: ["Name required"],
      });

      const result = EventRolePreparationService.prepareRoles([
        { name: "", description: "Test", maxParticipants: 10 },
      ]);

      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
      expect(result.error?.message).toBe("Invalid roles.");
    });

    it("should prepare roles with UUIDs when validation passes", () => {
      vi.mocked(validateRoles).mockReturnValue({ valid: true });

      const result = EventRolePreparationService.prepareRoles([
        { name: "Speaker", description: "Presents", maxParticipants: 5 },
        { name: "Attendee", description: "Watches", maxParticipants: 50 },
      ]);

      expect(result.valid).toBe(true);
      expect(result.roles).toHaveLength(2);
      expect(result.roles?.[0].id).toBe("mock-uuid-1234");
      expect(result.roles?.[0].name).toBe("Speaker");
      expect(result.totalSlots).toBe(55);
    });

    it("should default openToPublic to false when not provided", () => {
      vi.mocked(validateRoles).mockReturnValue({ valid: true });

      const result = EventRolePreparationService.prepareRoles([
        { name: "Role1", description: "Desc", maxParticipants: 10 },
      ]);

      expect(result.roles?.[0].openToPublic).toBe(false);
    });

    it("should set openToPublic to true when provided", () => {
      vi.mocked(validateRoles).mockReturnValue({ valid: true });

      const result = EventRolePreparationService.prepareRoles([
        {
          name: "Role1",
          description: "Desc",
          maxParticipants: 10,
          openToPublic: true,
        },
      ]);

      expect(result.roles?.[0].openToPublic).toBe(true);
    });

    it("should default agenda to empty string when not provided", () => {
      vi.mocked(validateRoles).mockReturnValue({ valid: true });

      const result = EventRolePreparationService.prepareRoles([
        { name: "Role1", description: "Desc", maxParticipants: 10 },
      ]);

      expect(result.roles?.[0].agenda).toBe("");
    });

    it("should use provided agenda value", () => {
      vi.mocked(validateRoles).mockReturnValue({ valid: true });

      const result = EventRolePreparationService.prepareRoles([
        {
          name: "Role1",
          description: "Desc",
          maxParticipants: 10,
          agenda: "Session agenda",
        },
      ]);

      expect(result.roles?.[0].agenda).toBe("Session agenda");
    });

    it("should preserve startTime and endTime when provided", () => {
      vi.mocked(validateRoles).mockReturnValue({ valid: true });

      const result = EventRolePreparationService.prepareRoles([
        {
          name: "Role1",
          description: "Desc",
          maxParticipants: 10,
          startTime: "09:00",
          endTime: "17:00",
        },
      ]);

      expect(result.roles?.[0].startTime).toBe("09:00");
      expect(result.roles?.[0].endTime).toBe("17:00");
    });

    it("should calculate totalSlots as sum of all maxParticipants", () => {
      vi.mocked(validateRoles).mockReturnValue({ valid: true });

      const result = EventRolePreparationService.prepareRoles([
        { name: "A", description: "", maxParticipants: 10 },
        { name: "B", description: "", maxParticipants: 20 },
        { name: "C", description: "", maxParticipants: 30 },
      ]);

      expect(result.totalSlots).toBe(60);
    });
  });
});
