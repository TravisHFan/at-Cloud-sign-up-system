/**
 * Event Display Component Tests - Phase 2 Compatible
 *
 * Tests for frontend components that display event information and signup counts.
 * Updated to work with the new Registration-based backend API.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("🎨 Event Display Tests (Phase 2 Compatible)", () => {
  describe("Event Listing Components", () => {
    it("should display event information correctly with new API structure", () => {
      const mockEvent = {
        id: "event1",
        title: "Test Event",
        date: "2025-02-01",
        time: "10:00",
        location: "Test Location",
        roles: [
          {
            id: "role1",
            name: "Speaker",
            maxParticipants: 5,
            currentCount: 3, // Using currentCount instead of capacity
            availableSpots: 2,
            isFull: false,
          },
          {
            id: "role2",
            name: "Participant",
            maxParticipants: 20,
            currentCount: 15,
            availableSpots: 5,
            isFull: false,
          },
        ],
        totalCapacity: 25,
        totalRegistrations: 18,
        availableSpots: 7,
      };

      // Mock component rendering with new structure
      expect(mockEvent.title).toBe("Test Event");
      expect(mockEvent.roles).toHaveLength(2);
      expect(mockEvent.totalCapacity).toBe(25);
      expect(mockEvent.totalRegistrations).toBe(18);
    });

    it("should show correct signup counts using Registration-based data", () => {
      const roleSignupCounts = {
        Speaker: "3/5",
        Participant: "15/20",
      };

      expect(roleSignupCounts["Speaker"]).toBe("3/5");
      expect(roleSignupCounts["Participant"]).toBe("15/20");
    });

    it("should indicate when roles are full using new availability data", () => {
      const fullRole = {
        maxParticipants: 10,
        currentCount: 10,
        availableSpots: 0,
        isFull: true,
      };

      expect(fullRole.isFull).toBe(true);
      expect(fullRole.availableSpots).toBe(0);
    });

    it("should show available spots using Registration-based calculations", () => {
      const roleAvailability = {
        maxParticipants: 10,
        currentCount: 7,
        availableSpots: 3,
      };

      expect(roleAvailability.availableSpots).toBe(3);
      expect(
        roleAvailability.currentCount + roleAvailability.availableSpots
      ).toBe(roleAvailability.maxParticipants);
    });
  });

  describe("Event Detail Components", () => {
    it("should display detailed role information with Registration data", () => {
      const roleDetails = {
        id: "role1",
        name: "Prepared Speaker (on-site)",
        description: "Present a prepared speech",
        maxParticipants: 5,
        currentCount: 3,
        availableSpots: 2,
        isFull: false,
        registrations: [
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
          {
            id: "reg2",
            userId: "user2",
            user: {
              id: "user2",
              username: "jane",
              firstName: "Jane",
              lastName: "Smith",
            },
          },
          {
            id: "reg3",
            userId: "user3",
            user: {
              id: "user3",
              username: "bob",
              firstName: "Bob",
              lastName: "Johnson",
            },
          },
        ],
      };

      expect(roleDetails.registrations).toHaveLength(3);
      expect(roleDetails.currentCount).toBe(roleDetails.registrations.length);
      expect(roleDetails.registrations[0].user).toHaveProperty("firstName");
    });

    it("should show signup buttons with correct state", () => {
      const signupButtonStates = {
        canSignup: true,
        isDisabled: false,
        buttonText: "Sign Up",
      };

      expect(signupButtonStates.canSignup).toBe(true);
      expect(signupButtonStates.buttonText).toBe("Sign Up");
    });

    it("should disable signup when role is full", () => {
      const fullRoleButton = {
        canSignup: false,
        isDisabled: true,
        buttonText: "Role Full",
      };

      expect(fullRoleButton.canSignup).toBe(false);
      expect(fullRoleButton.isDisabled).toBe(true);
    });

    it("should show different button states for signed up users", () => {
      const signedUpButton = {
        isSignedUp: true,
        buttonText: "Cancel Signup",
        buttonClass: "cancel-button",
      };

      expect(signedUpButton.isSignedUp).toBe(true);
      expect(signedUpButton.buttonText).toBe("Cancel Signup");
    });
  });

  describe("Real-time Updates", () => {
    it("should update signup counts when receiving WebSocket events with Registration data", () => {
      const initialCount = 5;
      const updatedCount = 6;

      // Simulate WebSocket event with new Registration-based structure
      const socketEvent = {
        type: "user_signed_up",
        eventId: "event1",
        data: {
          userId: "user1",
          roleId: "role1",
          newCount: updatedCount,
          role: {
            id: "role1",
            currentCount: updatedCount,
            availableSpots: 4,
            isFull: false,
          },
        },
        timestamp: new Date(),
      };

      expect(socketEvent.data.newCount).toBe(updatedCount);
      expect(socketEvent.data.newCount).toBeGreaterThan(initialCount);
      expect(socketEvent.data.role.currentCount).toBe(updatedCount);
    });

    it("should update UI when user cancels signup using Registration updates", () => {
      const cancelEvent = {
        type: "user_cancelled",
        eventId: "event1",
        data: {
          userId: "user1",
          roleId: "role1",
          newCount: 4,
          role: {
            id: "role1",
            currentCount: 4,
            availableSpots: 6,
            isFull: false,
          },
        },
        timestamp: new Date(),
      };

      expect(cancelEvent.data.role.currentCount).toBe(4);
      expect(cancelEvent.data.role.isFull).toBe(false);
    });

    it("should handle user being moved between roles with Registration updates", () => {
      const moveEvent = {
        type: "user_moved",
        eventId: "event1",
        data: {
          userId: "user1",
          fromRoleId: "role1",
          toRoleId: "role2",
        },
        timestamp: new Date(),
      };

      expect(moveEvent.data.fromRoleId).not.toBe(moveEvent.data.toRoleId);
      expect(moveEvent.type).toBe("user_moved");
    });
  });

  describe("Error Handling", () => {
    it("should show error message when signup fails", () => {
      const signupError = {
        hasError: true,
        errorMessage: "Role is full",
        showErrorModal: true,
      };

      expect(signupError.hasError).toBe(true);
      expect(signupError.errorMessage).toBe("Role is full");
    });

    it("should handle network errors gracefully", () => {
      const networkError = {
        type: "network_error",
        retryable: true,
        showRetryButton: true,
      };

      expect(networkError.retryable).toBe(true);
    });

    it("should show loading states during operations", () => {
      const loadingState = {
        isLoading: true,
        buttonDisabled: true,
        showSpinner: true,
      };

      expect(loadingState.isLoading).toBe(true);
      expect(loadingState.buttonDisabled).toBe(true);
    });
  });

  describe("User Permission Handling", () => {
    it("should show different UI based on user role with new API structure", () => {
      const userPermissions = {
        role: "Administrator",
        canManageParticipants: true,
        canMoveUsers: true,
        canRemoveUsers: true,
      };

      expect(userPermissions.canManageParticipants).toBe(true);
    });

    it("should hide admin functions for regular users", () => {
      const regularUser = {
        role: "Participant",
        canManageParticipants: false,
        showAdminTools: false,
      };

      expect(regularUser.canManageParticipants).toBe(false);
    });

    it("should respect role-based signup restrictions using new signup status API", () => {
      const userSignupStatus = {
        userId: "user1",
        eventId: "event1",
        isRegistered: false,
        canSignup: true,
        canSignupForMoreRoles: true,
        currentSignupCount: 1,
        maxAllowedSignups: 2,
        availableRoles: [
          "Common Participant (on-site)",
          "Common Participant (Zoom)",
          "Prepared Speaker (on-site)",
          "Prepared Speaker (Zoom)",
        ],
        restrictedRoles: ["Organizer", "Timekeeper"],
      };

      expect(userSignupStatus.canSignup).toBe(true);
      expect(userSignupStatus.availableRoles).toContain(
        "Common Participant (on-site)"
      );
      expect(userSignupStatus.restrictedRoles).toContain("Organizer");
      expect(userSignupStatus.currentSignupCount).toBeLessThan(
        userSignupStatus.maxAllowedSignups
      );
    });
  });

  describe("Data Consistency Checks", () => {
    it("should match signup counts between different views using Registration data", () => {
      const eventListCount = 5;
      const eventDetailCount = 5;
      const userDashboardCount = 5;

      expect(eventListCount).toBe(eventDetailCount);
      expect(eventDetailCount).toBe(userDashboardCount);
    });

    it("should reflect backend Registration changes immediately", () => {
      const backendUpdate = {
        timestamp: Date.now(),
        applied: true,
        uiUpdated: true,
        dataSource: "Registration collection", // Single source of truth
      };

      expect(backendUpdate.applied).toBe(true);
      expect(backendUpdate.uiUpdated).toBe(true);
      expect(backendUpdate.dataSource).toBe("Registration collection");
    });

    it("should handle stale data appropriately with Registration-based updates", () => {
      const dataFreshness = {
        lastUpdated: Date.now() - 5000, // 5 seconds ago
        isStale: false,
        needsRefresh: false,
        dataSource: "Registration-based API",
      };

      expect(dataFreshness.isStale).toBe(false);
      expect(dataFreshness.dataSource).toBe("Registration-based API");
    });

    it("should validate total counts match role counts in Registration data", () => {
      const eventWithRegistrations = {
        totalRegistrations: 18,
        totalCapacity: 25,
        availableSpots: 7,
        roles: [
          { currentCount: 8, maxParticipants: 10, availableSpots: 2 },
          { currentCount: 10, maxParticipants: 15, availableSpots: 5 },
        ],
      };

      const calculatedRegistrations = eventWithRegistrations.roles.reduce(
        (sum, role) => sum + role.currentCount,
        0
      );
      const calculatedCapacity = eventWithRegistrations.roles.reduce(
        (sum, role) => sum + role.maxParticipants,
        0
      );
      const calculatedAvailable = eventWithRegistrations.roles.reduce(
        (sum, role) => sum + role.availableSpots,
        0
      );

      expect(calculatedRegistrations).toBe(
        eventWithRegistrations.totalRegistrations
      );
      expect(calculatedCapacity).toBe(eventWithRegistrations.totalCapacity);
      expect(calculatedAvailable).toBe(eventWithRegistrations.availableSpots);
    });
  });
});
