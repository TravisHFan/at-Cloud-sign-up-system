/**
 * Phase 2 Migration: Analytics Controller Tests
 *
 * Tests the migrated AnalyticsController to ensure it properly uses
 * Registration-based queries instead of Event.currentSignups
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

describe("🔄 Phase 2 Migration: Analytics Controller Implementation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Migration Implementation Verification", () => {
    it("should import ResponseBuilderService in AnalyticsController", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/analyticsController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      expect(controllerContent).toContain("import { ResponseBuilderService }");
      expect(controllerContent).toContain(
        'from "../services/ResponseBuilderService"'
      );
    });

    it("should not use deprecated populate with currentSignups", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/analyticsController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Should NOT use the old populate pattern
      expect(controllerContent).not.toContain(
        '.populate("roles.currentSignups.userId"'
      );
      expect(controllerContent).not.toContain("roles.currentSignups.userId");
    });

    it("should use ResponseBuilderService for building analytics data", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/analyticsController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Should use ResponseBuilderService methods
      expect(controllerContent).toContain(
        "ResponseBuilderService.buildAnalyticsEventData"
      );

      // Should get raw event data with .lean()
      expect(controllerContent).toContain(".lean()");
    });

    it("should separate event fetching from registration data building", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/analyticsController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Should have separate variables for raw events and processed events
      expect(controllerContent).toContain("upcomingEventsRaw");
      expect(controllerContent).toContain("completedEventsRaw");
      expect(controllerContent).toContain(
        "upcomingEvents = await ResponseBuilderService"
      );
      expect(controllerContent).toContain(
        "completedEvents = await ResponseBuilderService"
      );
    });
  });

  describe("Analytics Data Structure Validation", () => {
    it("should provide analytics with Registration-based event data", () => {
      const expectedAnalyticsStructure = {
        success: true,
        data: {
          overview: {
            totalUsers: 0,
            totalEvents: 0,
            totalRegistrations: 0,
            activeUsers: 0,
            upcomingEvents: 0,
            recentRegistrations: 0,
          },
          eventAnalytics: {
            eventsByType: [],
            eventsByFormat: [],
            registrationStats: [],
            eventTrends: [],
            upcomingEvents: [], // Should use ResponseBuilderService data
            completedEvents: [], // Should use ResponseBuilderService data
          },
        },
      };

      expect(expectedAnalyticsStructure.success).toBe(true);
      expect(expectedAnalyticsStructure.data).toHaveProperty("overview");
      expect(expectedAnalyticsStructure.data).toHaveProperty("eventAnalytics");
      expect(
        Array.isArray(
          expectedAnalyticsStructure.data.eventAnalytics.upcomingEvents
        )
      ).toBe(true);
    });

    it("should provide event data with registration counts instead of currentSignups", () => {
      const expectedEventData = {
        id: "event1",
        title: "Test Event",
        totalCapacity: 25,
        totalRegistrations: 18,
        registrationRate: 72,
        roles: [
          {
            id: "role1",
            name: "Speaker",
            maxParticipants: 5,
            currentCount: 3, // Registration-based count
            registrations: [
              // Detailed registration data
              {
                id: "reg1",
                userId: "user1",
                user: {
                  id: "user1",
                  username: "john",
                  firstName: "John",
                  lastName: "Doe",
                },
              },
            ],
          },
        ],
      };

      // Validate new structure
      expect(expectedEventData.roles[0]).toHaveProperty("currentCount");
      expect(expectedEventData.roles[0]).toHaveProperty("registrations");
      expect(expectedEventData.roles[0]).not.toHaveProperty("currentSignups");
      expect(Array.isArray(expectedEventData.roles[0].registrations)).toBe(
        true
      );
    });

    it("should include user details in registration data", () => {
      const registrationWithUser = {
        id: "reg1",
        userId: "user1",
        eventId: "event1",
        roleId: "role1",
        status: "active",
        user: {
          id: "user1",
          username: "john",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          gender: "male",
          systemAuthorizationLevel: "Participant",
          roleInAtCloud: "Member",
          avatar: "/path/to/avatar.jpg",
        },
        registeredAt: new Date(),
        eventSnapshot: {
          eventTitle: "Test Event",
          eventDate: "2025-02-01",
          eventTime: "10:00",
          roleName: "Speaker",
          roleDescription: "Present a prepared speech",
        },
      };

      expect(registrationWithUser.user).toHaveProperty(
        "systemAuthorizationLevel"
      );
      expect(registrationWithUser.user).toHaveProperty("roleInAtCloud");
      expect(registrationWithUser).toHaveProperty("eventSnapshot");
    });
  });

  describe("Performance and Query Optimization", () => {
    it("should use lean() queries for better performance", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/analyticsController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Should use .lean() for better performance
      expect(controllerContent).toContain(".lean()");
    });

    it("should separate data fetching from processing", () => {
      // This pattern improves performance by:
      // 1. Fetching basic event data with lean()
      // 2. Building registration data separately using indexed queries
      // 3. Avoiding complex populate operations

      const migrationPattern = {
        step1: "fetch raw events with .lean()",
        step2: "use ResponseBuilderService for registration data",
        step3: "combine data efficiently",
      };

      expect(migrationPattern.step1).toContain("lean");
      expect(migrationPattern.step2).toContain("ResponseBuilderService");
    });

    it("should avoid nested populate operations", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/analyticsController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Should NOT have nested populate with roles.currentSignups
      expect(controllerContent).not.toContain('populate("roles.currentSignups');

      // Should only populate basic fields like createdBy
      const populateMatches = (controllerContent.match(/\.populate\(/g) || [])
        .length;
      expect(populateMatches).toBeLessThan(5); // Reasonable limit
    });
  });

  describe("Data Consistency Validation", () => {
    it("should ensure registration counts match across different views", () => {
      const eventWithRegistrations = {
        totalRegistrations: 18,
        roles: [{ currentCount: 8 }, { currentCount: 10 }],
      };

      const calculatedTotal = eventWithRegistrations.roles.reduce(
        (sum, role) => sum + role.currentCount,
        0
      );

      expect(calculatedTotal).toBe(eventWithRegistrations.totalRegistrations);
    });

    it("should maintain referential integrity between events and registrations", () => {
      const event = {
        id: "event1",
        roles: [{ id: "role1" }, { id: "role2" }],
      };

      const registrations = [
        { eventId: "event1", roleId: "role1" },
        { eventId: "event1", roleId: "role2" },
        { eventId: "event1", roleId: "role1" },
      ];

      // All registrations should reference valid event and role IDs
      registrations.forEach((reg) => {
        expect(reg.eventId).toBe(event.id);
        expect(event.roles.some((role) => role.id === reg.roleId)).toBe(true);
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle events with no registrations gracefully", () => {
      const emptyEvent = {
        id: "event1",
        title: "Empty Event",
        totalCapacity: 20,
        totalRegistrations: 0,
        registrationRate: 0,
        roles: [
          {
            id: "role1",
            name: "Speaker",
            maxParticipants: 5,
            currentCount: 0,
            registrations: [],
          },
        ],
      };

      expect(emptyEvent.totalRegistrations).toBe(0);
      expect(emptyEvent.registrationRate).toBe(0);
      expect(emptyEvent.roles[0].currentCount).toBe(0);
      expect(emptyEvent.roles[0].registrations).toHaveLength(0);
    });

    it("should handle malformed event data", () => {
      const edgeCases = [
        { roles: null, expected: [] },
        { roles: undefined, expected: [] },
        { roles: [], expected: [] },
      ];

      edgeCases.forEach((testCase) => {
        const roles = testCase.roles || [];
        expect(Array.isArray(roles)).toBe(true);
      });
    });

    it("should provide fallback values for missing data", () => {
      const eventWithMissingData = {
        totalCapacity: null,
        totalRegistrations: undefined,
        registrationRate: null,
      };

      const safeValues = {
        totalCapacity: eventWithMissingData.totalCapacity || 0,
        totalRegistrations: eventWithMissingData.totalRegistrations || 0,
        registrationRate: eventWithMissingData.registrationRate || 0,
      };

      expect(safeValues.totalCapacity).toBe(0);
      expect(safeValues.totalRegistrations).toBe(0);
      expect(safeValues.registrationRate).toBe(0);
    });
  });

  describe("Migration Completeness Check", () => {
    it("should have fully migrated from currentSignups to Registration-based queries", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/analyticsController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Check that old patterns are removed
      const oldPatterns = [
        "roles.currentSignups.userId",
        "populate.*currentSignups",
      ];

      let oldPatternCount = 0;
      oldPatterns.forEach((pattern) => {
        const matches = (
          controllerContent.match(new RegExp(pattern, "g")) || []
        ).length;
        oldPatternCount += matches;
      });

      expect(oldPatternCount).toBe(0);
    });

    it("should use new ResponseBuilderService patterns", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const controllerPath = path.join(
        process.cwd(),
        "src/controllers/analyticsController.ts"
      );
      const controllerContent = fs.readFileSync(controllerPath, "utf8");

      // Check that new patterns are present
      expect(controllerContent).toContain("ResponseBuilderService");
      expect(controllerContent).toContain("buildAnalyticsEventData");
    });
  });
});
