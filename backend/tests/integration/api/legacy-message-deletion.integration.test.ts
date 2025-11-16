import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Message from "../../../src/models/Message";
import { ROLES } from "../../../src/utils/roleUtils";
import { ensureIntegrationDB } from "../setup/connect";
import { TokenService } from "../../../src/middleware/auth";
import mongoose from "mongoose";
import { socketService } from "../../../src/services/infrastructure/SocketService";

describe("LegacyMessageDeletionController - DELETE /api/notifications/system/:messageId", () => {
  beforeEach(async () => {
    await ensureIntegrationDB();
    await User.deleteMany({});
    await Message.deleteMany({});

    // Mock socket service to prevent actual socket emissions
    vi.spyOn(socketService, "emitSystemMessageUpdate").mockImplementation(
      () => {}
    );
    vi.spyOn(socketService, "emitBellNotificationUpdate").mockImplementation(
      () => {}
    );
    vi.spyOn(socketService, "emitUnreadCountUpdate").mockImplementation(
      () => {}
    );
  });

  // Helper function to create a test message
  const createTestMessage = async (
    userId: mongoose.Types.ObjectId,
    options: Partial<{ title: string; content: string; isActive: boolean }> = {}
  ) => {
    return await Message.create({
      title: options.title || "Test System Message",
      content: options.content || "Test system message",
      type: "announcement",
      priority: "medium",
      creator: {
        id: userId.toString(),
        firstName: "Admin",
        lastName: "User",
        username: "admin",
        gender: "male" as const,
        authLevel: "Administrator",
      },
      isActive: options.isActive !== undefined ? options.isActive : true,
    });
  };

  // ========== Authentication Tests ==========
  describe("Authentication", () => {
    it("should return 401 when no token provided", async () => {
      const messageId = new mongoose.Types.ObjectId();
      const response = await request(app).delete(
        `/api/notifications/system/${messageId}`
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 401 when invalid token provided", async () => {
      const messageId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/notifications/system/${messageId}`)
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ========== Success Cases ==========
  describe("Success Cases", () => {
    it("should successfully delete message (soft delete)", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const message = await createTestMessage(user._id);

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Message deleted");

      // Verify message is soft deleted
      const updatedMessage = await Message.findById(message._id);
      expect(updatedMessage).toBeDefined();
      const userState = updatedMessage!.getUserState(user._id.toString());
      expect(userState.isDeletedFromSystem).toBe(true);
      expect(userState.isRemovedFromBell).toBe(true);
    });

    it("should emit socket events when deleting message", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const message = await createTestMessage(user._id);

      const token = TokenService.generateTokenPair(user).accessToken;

      await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token}`);

      // Verify socket emissions
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalledWith(
        user._id.toString(),
        "message_deleted",
        { messageId: message._id }
      );
      expect(socketService.emitBellNotificationUpdate).toHaveBeenCalledWith(
        user._id.toString(),
        "notification_removed",
        { messageId: message._id }
      );
    });

    it("should update unread counts when deleting unread message", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const message = await createTestMessage(user._id, {
        content: "Unread system message",
      });

      // Message is unread by default

      const token = TokenService.generateTokenPair(user).accessToken;

      await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token}`);

      // Verify unread count update was emitted
      expect(socketService.emitUnreadCountUpdate).toHaveBeenCalled();
    });

    it("should not update unread counts when deleting already read message", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const message = await createTestMessage(user._id, {
        content: "Read system message",
      });

      // Mark message as read
      message.markAsReadEverywhere(user._id.toString());
      await message.save();

      vi.clearAllMocks(); // Clear previous mock calls

      const token = TokenService.generateTokenPair(user).accessToken;

      await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token}`);

      // Verify unread count update was NOT emitted (message was already read)
      expect(socketService.emitUnreadCountUpdate).not.toHaveBeenCalled();
    });

    it("should allow different users to delete their own copy of the message", async () => {
      const user1 = await User.create({
        name: "User 1",
        username: "user1",
        email: "user1@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const user2 = await User.create({
        name: "User 2",
        username: "user2",
        email: "user2@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const message = await createTestMessage(user1._id, {
        content: "Broadcast message",
      });

      const token1 = TokenService.generateTokenPair(user1).accessToken;
      const token2 = TokenService.generateTokenPair(user2).accessToken;

      // User 1 deletes their copy
      const response1 = await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(response1.status).toBe(200);

      // User 2 deletes their copy
      const response2 = await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token2}`);

      expect(response2.status).toBe(200);

      // Verify both users have deleted the message
      const updatedMessage = await Message.findById(message._id);
      const user1State = updatedMessage!.getUserState(user1._id.toString());
      const user2State = updatedMessage!.getUserState(user2._id.toString());

      expect(user1State.isDeletedFromSystem).toBe(true);
      expect(user2State.isDeletedFromSystem).toBe(true);
    });
  });

  // ========== Edge Cases ==========
  describe("Edge Cases", () => {
    it("should return 400 when messageId is invalid ObjectId format", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .delete("/api/notifications/system/invalid-id")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid message ID");
    });

    it("should return 404 when message does not exist", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const nonExistentId = new mongoose.Types.ObjectId();

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .delete(`/api/notifications/system/${nonExistentId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Message not found");
    });

    it("should handle deletion of already deleted message gracefully", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const message = await createTestMessage(user._id);

      // Delete the message once
      message.deleteFromSystem(user._id.toString());
      await message.save();

      const token = TokenService.generateTokenPair(user).accessToken;

      // Try deleting again
      const response = await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Message deleted");
    });

    it("should auto-remove from bell when deleted from system (REQ 9)", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const message = await createTestMessage(user._id);

      const token = TokenService.generateTokenPair(user).accessToken;

      await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token}`);

      // Verify message is removed from both system and bell
      const updatedMessage = await Message.findById(message._id);
      const userState = updatedMessage!.getUserState(user._id.toString());

      expect(userState.isDeletedFromSystem).toBe(true);
      expect(userState.isRemovedFromBell).toBe(true);
      expect(userState.deletedFromSystemAt).toBeDefined();
      expect(userState.removedFromBellAt).toBeDefined();
    });

    it("should handle inactive message deletion", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const message = await createTestMessage(user._id, {
        content: "Inactive message",
        isActive: false,
      });

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Message deleted");
    });
  });

  // ========== Response Format ==========
  describe("Response Format", () => {
    it("should have correct success response structure", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const message = await createTestMessage(user._id);

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe("Message deleted");
    });

    it("should not include success field on 200 response", async () => {
      const user = await User.create({
        name: "Test User",
        username: "testuser",
        email: "user@test.com",
        password: "Password123",
        role: ROLES.PARTICIPANT,
        isActive: true,
        isVerified: true,
      });

      const message = await createTestMessage(user._id);

      const token = TokenService.generateTokenPair(user).accessToken;

      const response = await request(app)
        .delete(`/api/notifications/system/${message._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("success");
      expect(response.body).not.toHaveProperty("data");
    });
  });
});
