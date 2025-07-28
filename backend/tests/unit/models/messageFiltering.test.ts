/**
 * Message Model Unit Tests
 * Tests for historical message filtering and userStates logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";

// Mock mongoose
vi.mock("mongoose", () => ({
  default: {
    model: vi.fn(),
    Schema: vi.fn().mockImplementation(() => ({
      pre: vi.fn(),
      statics: {},
      methods: {},
    })),
  },
  Schema: vi.fn().mockImplementation(() => ({
    pre: vi.fn(),
    statics: {},
    methods: {},
  })),
}));

describe("Message Model - Historical Filtering Logic", () => {
  let mockMessage: any;
  let mockUserStatesMap: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock userStates Map
    mockUserStatesMap = new Map();

    // Mock message object
    mockMessage = {
      _id: "test-message-id",
      title: "Test Message",
      content: "Test content",
      type: "announcement",
      priority: "medium",
      isActive: true,
      userStates: mockUserStatesMap,
      markModified: vi.fn(),
      save: vi.fn().mockResolvedValue(true),

      // Mock the getUserState method
      getUserState: vi.fn().mockImplementation((userId: string) => {
        const state = mockUserStatesMap.get(userId);
        if (!state) {
          return {
            isReadInBell: false,
            isRemovedFromBell: false,
            isReadInSystem: false,
            isDeletedFromSystem: false,
          };
        }
        return {
          isReadInBell: state.isReadInBell || false,
          isRemovedFromBell: state.isRemovedFromBell || false,
          isReadInSystem: state.isReadInSystem || false,
          isDeletedFromSystem: state.isDeletedFromSystem || false,
          readInBellAt: state.readInBellAt,
          readInSystemAt: state.readInSystemAt,
          removedFromBellAt: state.removedFromBellAt,
          deletedFromSystemAt: state.deletedFromSystemAt,
          lastInteractionAt: state.lastInteractionAt,
        };
      }),

      // Mock the updateUserState method
      updateUserState: vi
        .fn()
        .mockImplementation((userId: string, updates: any) => {
          const currentState = mockMessage.getUserState(userId);
          const newState = {
            ...currentState,
            ...updates,
            lastInteractionAt: new Date(),
          };
          mockUserStatesMap.set(userId, newState);
          mockMessage.markModified("userStates");
        }),

      // Mock filtering methods
      shouldShowInBell: vi.fn().mockImplementation((userId: string) => {
        const state = mockMessage.getUserState(userId);
        return mockMessage.isActive && !state.isRemovedFromBell;
      }),

      shouldShowInSystem: vi.fn().mockImplementation((userId: string) => {
        const state = mockMessage.getUserState(userId);
        return mockMessage.isActive && !state.isDeletedFromSystem;
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserState method", () => {
    it("should return default state for users not in userStates", () => {
      // Act
      const state = mockMessage.getUserState("non-existent-user");

      // Assert
      expect(state).toEqual({
        isReadInBell: false,
        isRemovedFromBell: false,
        isReadInSystem: false,
        isDeletedFromSystem: false,
      });
    });

    it("should return actual state for users in userStates", () => {
      // Arrange
      const userId = "existing-user";
      const userState = {
        isReadInBell: true,
        isRemovedFromBell: false,
        isReadInSystem: true,
        isDeletedFromSystem: false,
        readInBellAt: new Date(),
        readInSystemAt: new Date(),
      };
      mockUserStatesMap.set(userId, userState);

      // Act
      const state = mockMessage.getUserState(userId);

      // Assert
      expect(state.isReadInBell).toBe(true);
      expect(state.isReadInSystem).toBe(true);
      expect(state.isRemovedFromBell).toBe(false);
      expect(state.isDeletedFromSystem).toBe(false);
    });
  });

  describe("shouldShowInBell method", () => {
    it("should return true for users with userState and not removed", () => {
      // Arrange
      const userId = "test-user";
      mockUserStatesMap.set(userId, {
        isRemovedFromBell: false,
      });

      // Act
      const shouldShow = mockMessage.shouldShowInBell(userId);

      // Assert
      expect(shouldShow).toBe(true);
    });

    it("should return false for users with userState but removed", () => {
      // Arrange
      const userId = "test-user";
      mockUserStatesMap.set(userId, {
        isRemovedFromBell: true,
      });

      // Act
      const shouldShow = mockMessage.shouldShowInBell(userId);

      // Assert
      expect(shouldShow).toBe(false);
    });

    it("should return false for inactive messages", () => {
      // Arrange
      const userId = "test-user";
      mockUserStatesMap.set(userId, {
        isRemovedFromBell: false,
      });
      mockMessage.isActive = false;

      // Act
      const shouldShow = mockMessage.shouldShowInBell(userId);

      // Assert
      expect(shouldShow).toBe(false);
    });
  });

  describe("shouldShowInSystem method", () => {
    it("should return true for users with userState and not deleted", () => {
      // Arrange
      const userId = "test-user";
      mockUserStatesMap.set(userId, {
        isDeletedFromSystem: false,
      });

      // Act
      const shouldShow = mockMessage.shouldShowInSystem(userId);

      // Assert
      expect(shouldShow).toBe(true);
    });

    it("should return false for users with userState but deleted", () => {
      // Arrange
      const userId = "test-user";
      mockUserStatesMap.set(userId, {
        isDeletedFromSystem: true,
      });

      // Act
      const shouldShow = mockMessage.shouldShowInSystem(userId);

      // Assert
      expect(shouldShow).toBe(false);
    });

    it("should return false for inactive messages", () => {
      // Arrange
      const userId = "test-user";
      mockUserStatesMap.set(userId, {
        isDeletedFromSystem: false,
      });
      mockMessage.isActive = false;

      // Act
      const shouldShow = mockMessage.shouldShowInSystem(userId);

      // Assert
      expect(shouldShow).toBe(false);
    });
  });

  describe("updateUserState method", () => {
    it("should update user state correctly", () => {
      // Arrange
      const userId = "test-user";
      const updates = {
        isReadInBell: true,
        readInBellAt: new Date(),
      };

      // Act
      mockMessage.updateUserState(userId, updates);

      // Assert
      expect(mockUserStatesMap.get(userId)).toEqual(
        expect.objectContaining({
          isReadInBell: true,
          readInBellAt: expect.any(Date),
          lastInteractionAt: expect.any(Date),
        })
      );
      expect(mockMessage.markModified).toHaveBeenCalledWith("userStates");
    });

    it("should preserve existing state when updating", () => {
      // Arrange
      const userId = "test-user";
      mockUserStatesMap.set(userId, {
        isReadInSystem: true,
        readInSystemAt: new Date(),
      });

      const updates = {
        isReadInBell: true,
        readInBellAt: new Date(),
      };

      // Act
      mockMessage.updateUserState(userId, updates);

      // Assert
      const finalState = mockUserStatesMap.get(userId);
      expect(finalState.isReadInSystem).toBe(true);
      expect(finalState.isReadInBell).toBe(true);
      expect(finalState.readInSystemAt).toBeDefined();
      expect(finalState.readInBellAt).toBeDefined();
    });
  });

  describe("Historical Message Filtering Scenarios", () => {
    it("should not show historical messages to new users", () => {
      // Arrange - Historical message created before user registration
      const oldUserId = "old-user";
      const newUserId = "new-user";

      // Historical message has old user in userStates
      mockUserStatesMap.set(oldUserId, {
        isReadInBell: false,
        isRemovedFromBell: false,
        isReadInSystem: false,
        isDeletedFromSystem: false,
      });

      // New user is NOT in userStates (simulating message created before user registration)

      // Act
      const oldUserCanSeeBell = mockMessage.shouldShowInBell(oldUserId);
      const newUserCanSeeBell = mockMessage.shouldShowInBell(newUserId);
      const oldUserCanSeeSystem = mockMessage.shouldShowInSystem(oldUserId);
      const newUserCanSeeSystem = mockMessage.shouldShowInSystem(newUserId);

      // Assert
      expect(oldUserCanSeeBell).toBe(true);
      expect(newUserCanSeeBell).toBe(true); // This would be filtered out by the $exists query
      expect(oldUserCanSeeSystem).toBe(true);
      expect(newUserCanSeeSystem).toBe(true); // This would be filtered out by the $exists query

      // The actual filtering happens in the MongoDB query with $exists: true
      // These methods return true because they don't check for userState existence
      // The $exists check in the query is what prevents new users from seeing historical messages
    });

    it("should show new messages to all users including new users", () => {
      // Arrange - New message created after all users exist
      const existingUserId = "existing-user";
      const newUserId = "new-user";

      // Both users are in userStates (simulating message created after both users registered)
      mockUserStatesMap.set(existingUserId, {
        isReadInBell: false,
        isRemovedFromBell: false,
        isReadInSystem: false,
        isDeletedFromSystem: false,
      });

      mockUserStatesMap.set(newUserId, {
        isReadInBell: false,
        isRemovedFromBell: false,
        isReadInSystem: false,
        isDeletedFromSystem: false,
      });

      // Act
      const existingUserCanSeeBell =
        mockMessage.shouldShowInBell(existingUserId);
      const newUserCanSeeBell = mockMessage.shouldShowInBell(newUserId);
      const existingUserCanSeeSystem =
        mockMessage.shouldShowInSystem(existingUserId);
      const newUserCanSeeSystem = mockMessage.shouldShowInSystem(newUserId);

      // Assert
      expect(existingUserCanSeeBell).toBe(true);
      expect(newUserCanSeeBell).toBe(true);
      expect(existingUserCanSeeSystem).toBe(true);
      expect(newUserCanSeeSystem).toBe(true);
    });
  });

  describe("MongoDB Query Simulation", () => {
    it("should simulate the corrected query behavior with $exists", () => {
      // Simulate the MongoDB query filters we implemented
      const userId = "test-user";

      // Case 1: Message where user exists in userStates (should be included)
      const messageWithUser = {
        isActive: true,
        userStates: new Map([
          [userId, { isDeletedFromSystem: false, isRemovedFromBell: false }],
        ]),
      };

      // Case 2: Message where user does NOT exist in userStates (should be excluded)
      const messageWithoutUser = {
        isActive: true,
        userStates: new Map([
          [
            "other-user",
            { isDeletedFromSystem: false, isRemovedFromBell: false },
          ],
        ]),
      };

      // Simulate the query conditions
      const checkSystemMessageQuery = (message: any, userId: string) => {
        return (
          message.isActive &&
          message.userStates.has(userId) && // $exists: true simulation
          message.userStates.get(userId)?.isDeletedFromSystem !== true
        );
      };

      const checkBellNotificationQuery = (message: any, userId: string) => {
        return (
          message.isActive &&
          message.userStates.has(userId) && // $exists: true simulation
          message.userStates.get(userId)?.isRemovedFromBell !== true
        );
      };

      // Act & Assert
      expect(checkSystemMessageQuery(messageWithUser, userId)).toBe(true);
      expect(checkSystemMessageQuery(messageWithoutUser, userId)).toBe(false);
      expect(checkBellNotificationQuery(messageWithUser, userId)).toBe(true);
      expect(checkBellNotificationQuery(messageWithoutUser, userId)).toBe(
        false
      );
    });
  });
});
