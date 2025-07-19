/**
 * Enhanced User Model Tests for System Messages & Bell Notifications
 *
 * This test suite validates the core business logic in the User model for:
 * - System message state management
 * - Bell notification state management
 * - Synchronization between the two systems
 * - User-specific isolation
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import mongoose from "mongoose";
import { User, SystemMessage } from "../../../src/models";

describe("User Model - System Messages & Bell Notifications Enhanced Tests", () => {
  let testUser: any;
  let otherUser: any;
  let testSystemMessage: any;

  beforeAll(async () => {
    // Connect to test database
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await User.deleteMany({});
    await SystemMessage.deleteMany({});

    // Create test users
    testUser = await User.create({
      firstName: "Test",
      lastName: "User",
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      role: "Participant",
      isActive: true,
      bellNotificationStates: [],
      systemMessageStates: [],
    });

    otherUser = await User.create({
      firstName: "Other",
      lastName: "User",
      username: "otheruser",
      email: "other@example.com",
      password: "password123",
      role: "Participant",
      isActive: true,
      bellNotificationStates: [],
      systemMessageStates: [],
    });

    // Create test system message
    testSystemMessage = await SystemMessage.create({
      title: "Test System Message",
      content: "Test content for system message",
      type: "announcement",
      priority: "medium",
      creator: {
        id: "admin-id",
        firstName: "Admin",
        lastName: "User",
        username: "admin",
        authLevel: "Administrator",
      },
      isActive: true,
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await SystemMessage.deleteMany({});
  });

  describe("Requirement 1 & 2: System Message State Management", () => {
    it("should add system message state for user", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);

      const systemState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(systemState).toBeDefined();
      expect(systemState.messageId).toBe(messageId);
      expect(systemState.isRead).toBe(false);
      expect(systemState.isDeleted).toBe(false);
      expect(systemState.readAt).toBeUndefined();
      expect(systemState.deletedAt).toBeUndefined();
    });

    it("should not add duplicate system message state", () => {
      const messageId = testSystemMessage._id.toString();

      // Add state twice
      testUser.addSystemMessageState(messageId);
      testUser.addSystemMessageState(messageId);

      const systemStates = testUser.systemMessageStates.filter(
        (state: any) => state.messageId === messageId
      );

      expect(systemStates).toHaveLength(1);
    });

    it("should mark system message as read", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);

      const success = testUser.markSystemMessageAsRead(messageId);

      expect(success).toBe(true);

      const systemState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(systemState.isRead).toBe(true);
      expect(systemState.readAt).toBeDefined();
      expect(systemState.readAt).toBeInstanceOf(Date);
    });

    it("should mark system message as unread", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.markSystemMessageAsRead(messageId);

      const success = testUser.markSystemMessageAsUnread(messageId);

      expect(success).toBe(true);

      const systemState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(systemState.isRead).toBe(false);
      expect(systemState.readAt).toBeUndefined();
    });

    it("should delete system message for user", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);

      const success = testUser.deleteSystemMessage(messageId);

      expect(success).toBe(true);

      const systemState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(systemState.isDeleted).toBe(true);
      expect(systemState.deletedAt).toBeDefined();
      expect(systemState.deletedAt).toBeInstanceOf(Date);
    });

    it("should not affect other users when deleting system message", async () => {
      const messageId = testSystemMessage._id.toString();

      // Add message state for both users
      testUser.addSystemMessageState(messageId);
      otherUser.addSystemMessageState(messageId);

      await testUser.save();
      await otherUser.save();

      // Delete for test user only
      testUser.deleteSystemMessage(messageId);
      await testUser.save();

      // Reload other user to check state
      await otherUser.reload();

      const testUserState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );
      const otherUserState = otherUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(testUserState.isDeleted).toBe(true);
      expect(otherUserState.isDeleted).toBe(false);
    });
  });

  describe("Requirement 5 & 6: Bell Notification State Management", () => {
    it("should add bell notification state for user", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addBellNotificationState(messageId);

      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState).toBeDefined();
      expect(bellState.messageId).toBe(messageId);
      expect(bellState.isRead).toBe(false);
      expect(bellState.isRemoved).toBe(false);
      expect(bellState.readAt).toBeUndefined();
      expect(bellState.removedAt).toBeUndefined();
    });

    it("should not add duplicate bell notification state", () => {
      const messageId = testSystemMessage._id.toString();

      // Add state twice
      testUser.addBellNotificationState(messageId);
      testUser.addBellNotificationState(messageId);

      const bellStates = testUser.bellNotificationStates.filter(
        (state: any) => state.messageId === messageId
      );

      expect(bellStates).toHaveLength(1);
    });

    it("should mark bell notification as read", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addBellNotificationState(messageId);

      const success = testUser.markBellNotificationAsRead(messageId);

      expect(success).toBe(true);

      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState.isRead).toBe(true);
      expect(bellState.readAt).toBeDefined();
      expect(bellState.readAt).toBeInstanceOf(Date);
    });

    it("should remove bell notification without affecting system message", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);

      const success = testUser.removeBellNotification(messageId);

      expect(success).toBe(true);

      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );
      const systemState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState.isRemoved).toBe(true);
      expect(bellState.removedAt).toBeDefined();
      expect(systemState.isDeleted).toBe(false);
    });

    it("should be idempotent when marking as read multiple times", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addBellNotificationState(messageId);

      // Mark as read twice
      const firstResult = testUser.markBellNotificationAsRead(messageId);
      const secondResult = testUser.markBellNotificationAsRead(messageId);

      expect(firstResult).toBe(true);
      expect(secondResult).toBe(true); // Should be idempotent
    });

    it("should handle removal of already removed bell notification", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addBellNotificationState(messageId);

      // Remove twice
      const firstResult = testUser.removeBellNotification(messageId);
      const secondResult = testUser.removeBellNotification(messageId);

      expect(firstResult).toBe(true);
      expect(secondResult).toBe(false); // Should return false for already removed
    });
  });

  describe("Requirement 8: Synchronization Between Systems", () => {
    it("should sync system message read status to bell notification", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);

      // Mark system message as read
      testUser.markSystemMessageAsRead(messageId);

      // Bell notification should also be marked as read automatically
      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState.isRead).toBe(true);
      expect(bellState.readAt).toBeDefined();
    });

    it("should sync bell notification read status to system message", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);

      // Mark bell notification as read
      testUser.markBellNotificationAsRead(messageId);

      // System message should also be marked as read automatically
      const systemState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(systemState.isRead).toBe(true);
      expect(systemState.readAt).toBeDefined();
    });

    it("should use syncSystemMessageToBellNotification method directly", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);

      // Mark system message as read first
      testUser.markSystemMessageAsRead(messageId);

      // Manually trigger sync
      const success = testUser.syncSystemMessageToBellNotification(messageId);

      expect(success).toBe(true);

      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState.isRead).toBe(true);
      expect(bellState.readAt).toBeDefined();
    });

    it("should maintain independence of removal states", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);

      // Remove bell notification
      testUser.removeBellNotification(messageId);

      // System message should remain undeleted
      const systemState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );
      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState.isRemoved).toBe(true);
      expect(systemState.isDeleted).toBe(false);
    });
  });

  describe("Requirement 9: Auto-delete Bell Notifications on System Message Deletion", () => {
    it("should auto-remove bell notification when system message is deleted", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);

      // Delete system message
      testUser.deleteSystemMessage(messageId);

      // Bell notification should be auto-removed
      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState.isRemoved).toBe(true);
      expect(bellState.removedAt).toBeDefined();
    });

    it("should auto-remove read bell notifications when system message is deleted", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);

      // Mark bell notification as read first
      testUser.markBellNotificationAsRead(messageId);

      // Delete system message
      testUser.deleteSystemMessage(messageId);

      // Bell notification should be auto-removed regardless of read status
      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState.isRemoved).toBe(true);
      expect(bellState.removedAt).toBeDefined();
    });
  });

  describe("Requirement 7: Persistence and Data Integrity", () => {
    it("should persist all state changes after save", async () => {
      const messageId = testSystemMessage._id.toString();

      // Add states and make changes
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);
      testUser.markSystemMessageAsRead(messageId);
      testUser.markBellNotificationAsRead(messageId);

      // Save to database
      await testUser.save();

      // Reload from database
      const reloadedUser = await User.findById(testUser._id);

      const systemState = reloadedUser?.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );
      const bellState = reloadedUser?.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(systemState?.isRead).toBe(true);
      expect(systemState?.readAt).toBeDefined();
      expect(bellState?.isRead).toBe(true);
      expect(bellState?.readAt).toBeDefined();
    });

    it("should maintain data consistency across operations", async () => {
      const messageId = testSystemMessage._id.toString();

      // Perform complex sequence of operations
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);
      testUser.markSystemMessageAsRead(messageId); // Should sync to bell
      testUser.removeBellNotification(messageId); // Should not affect system message

      await testUser.save();

      const systemState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );
      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      // Verify final state consistency
      expect(systemState.isRead).toBe(true);
      expect(systemState.isDeleted).toBe(false);
      expect(bellState.isRead).toBe(true);
      expect(bellState.isRemoved).toBe(true);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle operations on non-existent messages gracefully", () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const readResult = testUser.markSystemMessageAsRead(nonExistentId);
      const deleteResult = testUser.deleteSystemMessage(nonExistentId);
      const bellReadResult = testUser.markBellNotificationAsRead(nonExistentId);
      const bellRemoveResult = testUser.removeBellNotification(nonExistentId);

      expect(readResult).toBe(false);
      expect(deleteResult).toBe(false);
      expect(bellReadResult).toBe(false);
      expect(bellRemoveResult).toBe(false);
    });

    it("should handle invalid message IDs gracefully", () => {
      const invalidId = "invalid-id";

      expect(() => {
        testUser.markSystemMessageAsRead(invalidId);
      }).not.toThrow();

      expect(() => {
        testUser.addBellNotificationState(invalidId);
      }).not.toThrow();
    });

    it("should maintain state isolation between users", async () => {
      const messageId = testSystemMessage._id.toString();

      // Both users add the same message
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);

      otherUser.addSystemMessageState(messageId);
      otherUser.addBellNotificationState(messageId);

      // Test user marks as read and deletes
      testUser.markSystemMessageAsRead(messageId);
      testUser.deleteSystemMessage(messageId);

      // Other user's state should be unaffected
      const otherSystemState = otherUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );
      const otherBellState = otherUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(otherSystemState.isRead).toBe(false);
      expect(otherSystemState.isDeleted).toBe(false);
      expect(otherBellState.isRead).toBe(false);
      expect(otherBellState.isRemoved).toBe(false);
    });
  });

  describe("Bulk Operations for Mark All Read", () => {
    it("should mark all bell notifications as read", () => {
      // Add multiple bell notifications
      const messageIds = [
        testSystemMessage._id.toString(),
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString(),
      ];

      messageIds.forEach((id) => {
        testUser.addBellNotificationState(id);
      });

      // Mark all as read
      const success = testUser.markAllBellNotificationsAsRead();

      expect(success).toBe(true);

      // Verify all are marked as read
      testUser.bellNotificationStates.forEach((state: any) => {
        expect(state.isRead).toBe(true);
        expect(state.readAt).toBeDefined();
      });
    });

    it("should handle empty bell notification states gracefully", () => {
      const success = testUser.markAllBellNotificationsAsRead();
      expect(success).toBe(true); // Should succeed even with no notifications
    });
  });
});
