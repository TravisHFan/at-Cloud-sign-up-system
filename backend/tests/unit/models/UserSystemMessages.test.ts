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
import dotenv from "dotenv";
import { User, SystemMessage } from "../../../src/models";

// Load environment variables
dotenv.config();

describe("User Model - System Messages State Management", () => {
  let testUser: any;
  let testSystemMessage: any;

  beforeAll(async () => {
    if (!process.env.MONGODB_URI_TEST) {
      throw new Error("MONGODB_URI_TEST environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await SystemMessage.deleteMany({});

    // Create test user
    testUser = await User.create({
      username: "testuser",
      email: "test@example.com",
      password: "TestPassword123",
      firstName: "Test",
      lastName: "User",
      role: "Participant",
      isVerified: true,
      isActive: true,
    });

    // Create test system message
    testSystemMessage = await SystemMessage.create({
      title: "Test System Message",
      content: "Test content",
      type: "announcement",
      priority: "medium",
      creator: {
        id: "creator123",
        firstName: "Admin",
        lastName: "User",
        username: "admin",
        avatar: "",
        gender: "male",
        roleInAtCloud: "Administrator",
        authLevel: "Administrator",
      },
      isActive: true,
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await SystemMessage.deleteMany({});
  });

  describe("System Message State Management", () => {
    it("should add system message state for user", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);

      const messageState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(messageState).toBeDefined();
      expect(messageState.messageId).toBe(messageId);
      expect(messageState.isRead).toBe(false);
      expect(messageState.isDeleted).toBe(false);
      expect(messageState.readAt).toBeUndefined();
      expect(messageState.deletedAt).toBeUndefined();
    });

    it("should not add duplicate system message state", () => {
      const messageId = testSystemMessage._id.toString();

      // Add state twice
      testUser.addSystemMessageState(messageId);
      testUser.addSystemMessageState(messageId);

      const messageStates = testUser.systemMessageStates.filter(
        (state: any) => state.messageId === messageId
      );

      expect(messageStates).toHaveLength(1);
    });

    it("should mark system message as read (Requirement 1)", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);

      const success = testUser.markSystemMessageAsRead(messageId);

      expect(success).toBe(true);

      const messageState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(messageState.isRead).toBe(true);
      expect(messageState.readAt).toBeDefined();
      expect(messageState.readAt).toBeInstanceOf(Date);
    });

    it("should return false when marking non-existent message as read", () => {
      const fakeMessageId = new mongoose.Types.ObjectId().toString();
      const success = testUser.markSystemMessageAsRead(fakeMessageId);

      expect(success).toBe(false);
    });

    it("should return false when marking already read message as read", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);

      // Mark as read first time
      const firstResult = testUser.markSystemMessageAsRead(messageId);
      expect(firstResult).toBe(true);

      // Try to mark as read again
      const secondResult = testUser.markSystemMessageAsRead(messageId);
      expect(secondResult).toBe(false);
    });

    it("should delete system message for user only (Requirement 2)", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);

      const success = testUser.deleteSystemMessage(messageId);

      expect(success).toBe(true);

      const messageState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(messageState.isDeleted).toBe(true);
      expect(messageState.deletedAt).toBeDefined();
      expect(messageState.deletedAt).toBeInstanceOf(Date);
    });

    it("should return false when deleting non-existent message", () => {
      const fakeMessageId = new mongoose.Types.ObjectId().toString();
      const success = testUser.deleteSystemMessage(fakeMessageId);

      expect(success).toBe(false);
    });

    it("should return false when deleting already deleted message", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);

      // Delete first time
      const firstResult = testUser.deleteSystemMessage(messageId);
      expect(firstResult).toBe(true);

      // Try to delete again
      const secondResult = testUser.deleteSystemMessage(messageId);
      expect(secondResult).toBe(false);
    });
  });

  describe("Bell Notification State Management - Requirements 5-6", () => {
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

    it("should mark bell notification as read (Requirement 5)", () => {
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

    it("should remove bell notification (Requirement 6)", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addBellNotificationState(messageId);

      const success = testUser.removeBellNotification(messageId);

      expect(success).toBe(true);

      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState.isRemoved).toBe(true);
      expect(bellState.removedAt).toBeDefined();
      expect(bellState.removedAt).toBeInstanceOf(Date);
    });

    it("should return false when operating on non-existent bell notification", () => {
      const fakeMessageId = new mongoose.Types.ObjectId().toString();

      const readResult = testUser.markBellNotificationAsRead(fakeMessageId);
      const removeResult = testUser.removeBellNotification(fakeMessageId);

      expect(readResult).toBe(false);
      expect(removeResult).toBe(false);
    });

    it("should return true when marking already read bell notification as read (idempotent)", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addBellNotificationState(messageId);

      // Mark as read first time
      const firstResult = testUser.markBellNotificationAsRead(messageId);
      expect(firstResult).toBe(true);

      // Try to mark as read again - should be idempotent and return true
      const secondResult = testUser.markBellNotificationAsRead(messageId);
      expect(secondResult).toBe(true); // API should be idempotent
    });

    it("should return false when removing already removed bell notification", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addBellNotificationState(messageId);

      // Remove first time
      const firstResult = testUser.removeBellNotification(messageId);
      expect(firstResult).toBe(true);

      // Try to remove again
      const secondResult = testUser.removeBellNotification(messageId);
      expect(secondResult).toBe(false);
    });
  });

  describe("Synchronization - Requirement 8", () => {
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

    it("should sync when using syncSystemMessageToBellNotification directly", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addBellNotificationState(messageId);

      const success = testUser.syncSystemMessageToBellNotification(messageId);

      expect(success).toBe(true);

      const bellState = testUser.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState.isRead).toBe(true);
      expect(bellState.readAt).toBeDefined();
    });

    it("should maintain independence of bell notification removal", () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.addBellNotificationState(messageId);

      // Remove bell notification
      testUser.removeBellNotification(messageId);

      // System message state should be unaffected
      const messageState = testUser.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(messageState.isDeleted).toBe(false);
      expect(messageState.isRead).toBe(false);
    });
  });

  describe("Unread Counts", () => {
    it("should calculate correct unread counts", () => {
      const messageId1 = testSystemMessage._id.toString();
      const messageId2 = new mongoose.Types.ObjectId().toString();

      // Add some states
      testUser.addSystemMessageState(messageId1);
      testUser.addSystemMessageState(messageId2);
      testUser.addBellNotificationState(messageId1);
      testUser.addBellNotificationState(messageId2);

      // Mark one as read
      testUser.markSystemMessageAsRead(messageId1);

      const counts = testUser.getUnreadCounts();

      expect(counts.systemMessages).toBe(1); // One unread system message
      expect(counts.bellNotificationStates).toBe(1); // One unread bell notification (synced)
      expect(counts.total).toBeGreaterThan(0);
    });

    it("should not count deleted messages in unread counts", () => {
      const messageId = testSystemMessage._id.toString();

      testUser.addSystemMessageState(messageId);
      testUser.deleteSystemMessage(messageId);

      const counts = testUser.getUnreadCounts();

      expect(counts.systemMessages).toBe(0);
    });

    it("should not count removed bell notifications in unread counts", () => {
      const messageId = testSystemMessage._id.toString();

      testUser.addBellNotificationState(messageId);
      testUser.removeBellNotification(messageId);

      const counts = testUser.getUnreadCounts();

      expect(counts.bellNotificationStates).toBe(0);
    });
  });

  describe("Persistence - Requirement 7", () => {
    it("should persist system message state after save and reload", async () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.markSystemMessageAsRead(messageId);

      await testUser.save();

      // Reload user from database
      const reloadedUser = await User.findById(testUser._id);

      const messageState = reloadedUser?.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(messageState).toBeDefined();
      expect(messageState!.isRead).toBe(true);
      expect(messageState!.readAt).toBeDefined();
    });

    it("should persist bell notification state after save and reload", async () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addBellNotificationState(messageId);
      testUser.markBellNotificationAsRead(messageId);

      await testUser.save();

      // Reload user from database
      const reloadedUser = await User.findById(testUser._id);

      const bellState = reloadedUser?.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState).toBeDefined();
      expect(bellState!.isRead).toBe(true);
      expect(bellState!.readAt).toBeDefined();
    });

    it("should persist deletion state after save and reload", async () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addSystemMessageState(messageId);
      testUser.deleteSystemMessage(messageId);

      await testUser.save();

      // Reload user from database
      const reloadedUser = await User.findById(testUser._id);

      const messageState = reloadedUser?.systemMessageStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(messageState).toBeDefined();
      expect(messageState!.isDeleted).toBe(true);
      expect(messageState!.deletedAt).toBeDefined();
    });

    it("should persist removal state after save and reload", async () => {
      const messageId = testSystemMessage._id.toString();
      testUser.addBellNotificationState(messageId);
      testUser.removeBellNotification(messageId);

      await testUser.save();

      // Reload user from database
      const reloadedUser = await User.findById(testUser._id);

      const bellState = reloadedUser?.bellNotificationStates.find(
        (state: any) => state.messageId === messageId
      );

      expect(bellState).toBeDefined();
      expect(bellState!.isRemoved).toBe(true);
      expect(bellState!.removedAt).toBeDefined();
    });
  });
});
