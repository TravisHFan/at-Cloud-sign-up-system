/**
 * Phase 1 Migration: EventController Implementation Test
 *
 * This test validates that the actual EventController.ts file
 * has been properly migrated to use RegistrationQueryService
 * instead of Event.currentSignups
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RegistrationQueryService } from "../../src/services/RegistrationQueryService";

describe("🔄 Phase 1 Migration: EventController Implementation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Migration Implementation Verification", () => {
    it("should import RegistrationQueryService in EventController", async () => {
      // Read the EventController file to verify it imports RegistrationQueryService
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/eventController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      expect(controllerContent).toContain(
        "import { RegistrationQueryService }"
      );
      expect(controllerContent).toContain(
        'from "../services/RegistrationQueryService"'
      );
    });

    it("should use RegistrationQueryService.getUserSignupInfo for user signup checks", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/eventController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Should use the new service call
      expect(controllerContent).toContain(
        "RegistrationQueryService.getUserSignupInfo"
      );

      // Should NOT use the old reduce method for counting signups
      expect(controllerContent).not.toContain(
        "event.roles.reduce((count, role) => {"
      );
      expect(controllerContent).not.toContain("role.currentSignups.filter(");
    });

    it("should use RegistrationQueryService.getRoleAvailability for capacity checks", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/eventController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Should use the new service call
      expect(controllerContent).toContain(
        "RegistrationQueryService.getRoleAvailability"
      );

      // Should NOT use the old direct currentSignups access for capacity checks
      expect(controllerContent).not.toContain(
        "targetRole.currentSignups.length >= targetRole.maxParticipants"
      );
    });

    it("should not manipulate Event.currentSignups arrays directly", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/eventController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Should NOT manipulate currentSignups arrays directly
      expect(controllerContent).not.toContain(
        "role.currentSignups = role.currentSignups.filter"
      );
      expect(controllerContent).not.toContain(
        "sourceRole.currentSignups.splice"
      );
      expect(controllerContent).not.toContain("targetRole.currentSignups.push");
      expect(controllerContent).not.toContain("currentSignups.findIndex");
    });

    it("should rely on Registration collection as single source of truth", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/eventController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Should use Registration queries
      expect(controllerContent).toContain("Registration.findOne");
      expect(controllerContent).toContain("Registration.findOneAndDelete");

      // Should not save event just to update currentSignups
      const eventSaveOccurrences = (
        controllerContent.match(/await event\.save\(\)/g) || []
      ).length;

      // There should be fewer event.save() calls now since we don't need to save
      // just to update currentSignups arrays
      expect(eventSaveOccurrences).toBeLessThan(10); // Reasonable expectation
    });
  });

  describe("Service Integration Validation", () => {
    it("should verify RegistrationQueryService methods exist and are callable", () => {
      expect(RegistrationQueryService.getUserSignupInfo).toBeDefined();
      expect(RegistrationQueryService.getRoleAvailability).toBeDefined();
      expect(RegistrationQueryService.getEventSignupCounts).toBeDefined();
      expect(RegistrationQueryService.isUserRegisteredForRole).toBeDefined();

      expect(typeof RegistrationQueryService.getUserSignupInfo).toBe(
        "function"
      );
      expect(typeof RegistrationQueryService.getRoleAvailability).toBe(
        "function"
      );
      expect(typeof RegistrationQueryService.getEventSignupCounts).toBe(
        "function"
      );
      expect(typeof RegistrationQueryService.isUserRegisteredForRole).toBe(
        "function"
      );
    });

    it("should maintain expected function signatures", () => {
      // Check that our service methods match the expected signatures
      const userSignupInfo = RegistrationQueryService.getUserSignupInfo;
      const roleAvailability = RegistrationQueryService.getRoleAvailability;

      // These should be async functions (return promises)
      expect(userSignupInfo("test-user-id")).toBeInstanceOf(Promise);
      expect(roleAvailability("test-event-id", "test-role-id")).toBeInstanceOf(
        Promise
      );
    });
  });

  describe("Migration Completeness Check", () => {
    it("should have migrated all major currentSignups usage patterns", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/eventController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Check that problematic patterns have been removed/reduced
      const problematicPatterns = [
        "role\\.currentSignups\\.filter",
        "currentSignups\\.findIndex",
        "currentSignups\\.splice",
        "currentSignups\\.push",
        "roles\\.reduce\\(\\(count, role\\)",
      ];

      let remainingProblematicUsage = 0;
      problematicPatterns.forEach((pattern) => {
        const matches = (
          controllerContent.match(new RegExp(pattern, "g")) || []
        ).length;
        remainingProblematicUsage += matches;
      });

      // We should have significantly reduced problematic usage
      // (Some might remain in comments or other contexts)
      expect(remainingProblematicUsage).toBeLessThan(3);
    });

    it("should maintain Event.currentSignups only for schema compatibility", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/eventController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Event creation should still initialize currentSignups: [] for schema compatibility
      expect(controllerContent).toContain("currentSignups: []");

      // But operational logic should not rely on it
      const operationalUsage = [
        "currentSignups.length",
        "currentSignups[",
        "currentSignups.map",
        "currentSignups.forEach",
      ];

      let operationalCount = 0;
      operationalUsage.forEach((pattern) => {
        const matches = (
          controllerContent.match(
            new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
          ) || []
        ).length;
        operationalCount += matches;
      });

      // Should have minimal operational usage of currentSignups
      expect(operationalCount).toBeLessThan(2);
    });
  });

  describe("Performance Validation", () => {
    it("should use Registration-based queries that support indexing", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/eventController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Should use Registration queries that can be indexed
      expect(controllerContent).toContain("Registration.findOne");
      expect(controllerContent).toContain("Registration.findOneAndDelete");

      // Should not have nested array operations that can't be indexed well
      expect(controllerContent).not.toContain("event.roles.map");
      expect(controllerContent).not.toContain("role.currentSignups.map");
    });
  });
});
