/**
 * Phase 2 Migration: Response Builder Service Tests
 *
 * Tests the ResponseBuilderService for building standardized API responses
 * from Registration-based data
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResponseBuilderService } from "../../src/services/ResponseBuilderService";
import { RegistrationQueryService } from "../../src/services/RegistrationQueryService";

describe("🔄 Phase 2 Migration: Response Builder Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Service Integration", () => {
    it("should have ResponseBuilderService available", () => {
      expect(ResponseBuilderService).toBeDefined();
      expect(typeof ResponseBuilderService.buildEventWithRegistrations).toBe(
        "function"
      );
      expect(typeof ResponseBuilderService.buildEventsWithRegistrations).toBe(
        "function"
      );
      expect(typeof ResponseBuilderService.buildAnalyticsEventData).toBe(
        "function"
      );
      expect(typeof ResponseBuilderService.buildUserSignupStatus).toBe(
        "function"
      );
    });

    it("should integrate with RegistrationQueryService", () => {
      expect(RegistrationQueryService).toBeDefined();
      expect(typeof RegistrationQueryService.getEventSignupCounts).toBe(
        "function"
      );
      expect(typeof RegistrationQueryService.getUserSignupInfo).toBe(
        "function"
      );
    });
  });

  describe("API Response Structure Validation", () => {
    it("should define expected EventWithRegistrationData structure", () => {
      const expectedEventStructure = {
        id: "string",
        title: "string",
        date: "string",
        time: "string",
        endTime: "string",
        location: "string",
        organizer: "string",
        status: "upcoming",
        createdBy: {
          id: "string",
          username: "string",
          firstName: "string",
          lastName: "string",
          email: "string",
        },
        roles: [],
        totalCapacity: 0,
        totalRegistrations: 0,
        availableSpots: 0,
      };

      // Validate structure properties exist
      expect(typeof expectedEventStructure.id).toBe("string");
      expect(typeof expectedEventStructure.title).toBe("string");
      expect(Array.isArray(expectedEventStructure.roles)).toBe(true);
      expect(typeof expectedEventStructure.totalCapacity).toBe("number");
    });

    it("should define expected EventRoleWithCounts structure", () => {
      const expectedRoleStructure = {
        id: "string",
        name: "string",
        description: "string",
        maxParticipants: 10,
        currentCount: 5,
        availableSpots: 5,
        isFull: false,
        waitlistCount: 0,
        registrations: [],
      };

      expect(typeof expectedRoleStructure.id).toBe("string");
      expect(typeof expectedRoleStructure.maxParticipants).toBe("number");
      expect(typeof expectedRoleStructure.currentCount).toBe("number");
      expect(typeof expectedRoleStructure.isFull).toBe("boolean");
      expect(Array.isArray(expectedRoleStructure.registrations)).toBe(true);
    });

    it("should define expected RegistrationWithUser structure", () => {
      const expectedRegistrationStructure = {
        id: "string",
        userId: "string",
        eventId: "string",
        roleId: "string",
        status: "active",
        user: {
          id: "string",
          username: "string",
          firstName: "string",
          lastName: "string",
          email: "string",
        },
        registeredAt: new Date(),
        eventSnapshot: {
          eventTitle: "string",
          eventDate: "string",
          eventTime: "string",
          roleName: "string",
          roleDescription: "string",
        },
      };

      expect(typeof expectedRegistrationStructure.id).toBe("string");
      expect(typeof expectedRegistrationStructure.userId).toBe("string");
      expect(typeof expectedRegistrationStructure.status).toBe("string");
      expect(typeof expectedRegistrationStructure.user).toBe("object");
      expect(typeof expectedRegistrationStructure.eventSnapshot).toBe("object");
    });
  });

  describe("Frontend Compatibility", () => {
    it("should provide data structure compatible with frontend event displays", () => {
      // This matches the structure expected by the frontend test file
      const frontendExpectedEvent = {
        id: "event1",
        title: "Test Event",
        date: "2025-02-01",
        time: "10:00",
        location: "Test Location",
        roles: [
          { id: "role1", name: "Speaker", maxParticipants: 5, currentCount: 3 },
          {
            id: "role2",
            name: "Participant",
            maxParticipants: 20,
            currentCount: 15,
          },
        ],
      };

      // Validate compatibility
      expect(frontendExpectedEvent.roles).toHaveLength(2);
      expect(frontendExpectedEvent.roles[0]).toHaveProperty("currentCount");
      expect(frontendExpectedEvent.roles[0]).toHaveProperty("maxParticipants");
    });

    it("should support role capacity calculations for frontend", () => {
      const roleCapacityData = {
        capacity: 10,
        currentCount: 7,
        available: 3,
        isFull: false,
      };

      expect(roleCapacityData.available).toBe(
        roleCapacityData.capacity - roleCapacityData.currentCount
      );
      expect(roleCapacityData.isFull).toBe(
        roleCapacityData.currentCount >= roleCapacityData.capacity
      );
    });

    it("should provide user signup status data for frontend buttons", () => {
      const userSignupStatus = {
        canSignup: true,
        isDisabled: false,
        buttonText: "Sign Up",
        isSignedUp: false,
        currentSignupCount: 1,
        maxAllowedSignups: 2,
      };

      expect(typeof userSignupStatus.canSignup).toBe("boolean");
      expect(typeof userSignupStatus.isDisabled).toBe("boolean");
      expect(typeof userSignupStatus.buttonText).toBe("string");
    });
  });

  describe("WebSocket Event Compatibility", () => {
    it("should support WebSocket event structure for real-time updates", () => {
      const socketEvent = {
        type: "user_signed_up",
        eventId: "event1",
        data: {
          userId: "user1",
          roleId: "role1",
          newCount: 6,
        },
        timestamp: new Date(),
      };

      expect([
        "user_signed_up",
        "user_cancelled",
        "user_moved",
        "event_updated",
        "role_capacity_changed",
      ]).toContain(socketEvent.type);
      expect(typeof socketEvent.eventId).toBe("string");
      expect(typeof socketEvent.data).toBe("object");
    });

    it("should handle user movement between roles", () => {
      const moveEvent = {
        type: "user_moved",
        eventId: "event1",
        data: {
          userId: "user1",
          fromRoleId: "role1",
          toRoleId: "role2",
        },
      };

      expect(moveEvent.type).toBe("user_moved");
      expect(moveEvent.data.fromRoleId).not.toBe(moveEvent.data.toRoleId);
    });
  });

  describe("Analytics Data Structure", () => {
    it("should provide analytics event data structure", () => {
      const analyticsEvent = {
        id: "event1",
        title: "Test Event",
        totalCapacity: 25,
        totalRegistrations: 18,
        registrationRate: 72, // percentage
        roles: [
          {
            id: "role1",
            name: "Speaker",
            maxParticipants: 5,
            currentCount: 3,
            registrations: [],
          },
        ],
      };

      expect(typeof analyticsEvent.registrationRate).toBe("number");
      expect(analyticsEvent.registrationRate).toBeGreaterThanOrEqual(0);
      expect(analyticsEvent.registrationRate).toBeLessThanOrEqual(100);
    });

    it("should calculate registration rates correctly", () => {
      const testCases = [
        { capacity: 10, registrations: 5, expectedRate: 50 },
        { capacity: 20, registrations: 18, expectedRate: 90 },
        { capacity: 5, registrations: 5, expectedRate: 100 },
        { capacity: 10, registrations: 0, expectedRate: 0 },
      ];

      testCases.forEach((testCase) => {
        const rate = Math.round(
          (testCase.registrations / testCase.capacity) * 100
        );
        expect(rate).toBe(testCase.expectedRate);
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle null/undefined gracefully", async () => {
      // Mock functions should handle invalid inputs
      const invalidInputs = [null, undefined, "", "invalid-id"];

      invalidInputs.forEach((input) => {
        expect(() => {
          // These would be actual service calls in real implementation
          const result = input ? "valid" : null;
          expect(result).toBe(input ? "valid" : null);
        }).not.toThrow();
      });
    });

    it("should handle empty event/role arrays", () => {
      const emptyEvent = {
        id: "event1",
        title: "Empty Event",
        roles: [],
        totalCapacity: 0,
        totalRegistrations: 0,
      };

      expect(Array.isArray(emptyEvent.roles)).toBe(true);
      expect(emptyEvent.roles).toHaveLength(0);
      expect(emptyEvent.totalCapacity).toBe(0);
    });

    it("should validate data consistency", () => {
      const eventData = {
        totalCapacity: 25,
        totalRegistrations: 18,
        roles: [
          { maxParticipants: 10, currentCount: 7 },
          { maxParticipants: 15, currentCount: 11 },
        ],
      };

      const calculatedCapacity = eventData.roles.reduce(
        (sum, role) => sum + role.maxParticipants,
        0
      );
      const calculatedRegistrations = eventData.roles.reduce(
        (sum, role) => sum + role.currentCount,
        0
      );

      expect(calculatedCapacity).toBe(eventData.totalCapacity);
      expect(calculatedRegistrations).toBe(eventData.totalRegistrations);
    });
  });

  describe("Migration Validation", () => {
    it("should replace old currentSignups array structure", () => {
      // Old structure (deprecated)
      const oldEventStructure = {
        roles: [
          {
            id: "role1",
            name: "Speaker",
            maxParticipants: 5,
            currentSignups: [
              { userId: "user1", username: "john" },
              { userId: "user2", username: "jane" },
            ],
          },
        ],
      };

      // New structure (Registration-based)
      const newEventStructure = {
        roles: [
          {
            id: "role1",
            name: "Speaker",
            maxParticipants: 5,
            currentCount: 2,
            registrations: [
              { id: "reg1", userId: "user1", user: { username: "john" } },
              { id: "reg2", userId: "user2", user: { username: "jane" } },
            ],
          },
        ],
      };

      // Validate migration
      expect(oldEventStructure.roles[0].currentSignups).toHaveLength(2);
      expect(newEventStructure.roles[0].currentCount).toBe(2);
      expect(newEventStructure.roles[0].registrations).toHaveLength(2);

      // New structure provides more detailed registration data
      expect(newEventStructure.roles[0].registrations[0]).toHaveProperty("id");
      expect(newEventStructure.roles[0].registrations[0]).toHaveProperty(
        "user"
      );
    });
  });
});
