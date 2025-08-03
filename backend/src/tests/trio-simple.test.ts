/**
 * TRIO SYSTEM CORE FUNCTIONALITY TEST SUITE - PERMANENT
 * 
 * ⚠️  PERMANENT TEST SUITE - DO NOT DELETE OR CLEAN UP ⚠️ 
 * 
 * This simplified test suite validates core trio functionality without complex model dependencies.
 * Serves as a fast validation suite for CI/CD and development workflows.
 * 
 * PURPOSE: Quick validation of core trio notification functionality
 * STATUS: Core permanent test suite - maintained across all phases
 * SCOPE: Essential UnifiedMessageController validation
 * 
 * FEATURES TESTED:
 * - Core system message creation via UnifiedMessageController
 * - Multi-user targeting functionality
 * - Creator information validation
 * - User state management (userStates Map)
 * - Error handling for edge cases
 * - WebSocket emission validation
 * 
 * MAINTENANCE: Update when core trio API changes, never remove
 */import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import User from "../models/User";
import Message from "../models/Message";
import { UnifiedMessageController } from "../controllers/unifiedMessageController";
import { EmailService } from "../services/infrastructure/emailService";
import { socketService } from "../services/infrastructure/SocketService";
import { ROLES } from "../utils/roleUtils";

describe("TRIO NOTIFICATION SYSTEM - Core Functionality Test", () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let adminUser: any;

  beforeEach(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test users
    testUser = await User.create({
      firstName: "Test",
      lastName: "User",
      username: "testuser",
      email: "test@example.com",
      password: "ValidPassword123!",
      role: ROLES.PARTICIPANT,
      roleInAtCloud: "Member",
      isEmailVerified: true,
    });

    adminUser = await User.create({
      username: "admin",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      password: "AdminPassword123!",
      role: ROLES.ADMINISTRATOR,
      roleInAtCloud: "Pastor",
      isEmailVerified: true,
    });

    // Mock external services
    vi.spyOn(EmailService, "sendWelcomeEmail").mockResolvedValue(true);
    vi.spyOn(EmailService, "sendPasswordResetSuccessEmail").mockResolvedValue(
      true
    );
    vi.spyOn(socketService, "emitSystemMessageUpdate").mockImplementation(
      () => {}
    );
    vi.spyOn(socketService, "emitUnreadCountUpdate").mockImplementation(
      () => {}
    );
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
    vi.restoreAllMocks();
  });

  describe("✅ CORE TRIO FUNCTIONALITY", () => {
    it("should successfully create a targeted system message", async () => {
      const messageData = {
        title: "Test System Message",
        content: "This is a test message for API validation",
        type: "announcement",
        priority: "medium",
      };

      const creator = {
        id: adminUser._id.toString(),
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        username: adminUser.username,
        gender: adminUser.gender || "male",
        authLevel: adminUser.role,
        roleInAtCloud: adminUser.roleInAtCloud,
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        messageData,
        [testUser._id.toString()],
        creator
      );

      expect(result).toBeDefined();
      expect(result.title).toBe(messageData.title);
      expect(result.content).toBe(messageData.content);
      expect(result.type).toBe(messageData.type);
      expect(result.priority).toBe(messageData.priority);

      // Verify system message was created in database
      const savedMessage = await Message.findById(result._id);
      expect(savedMessage).toBeDefined();
      expect(savedMessage?.title).toBe(messageData.title);

      // Verify WebSocket emissions were called
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalledWith(
        testUser._id.toString(),
        "message_created",
        expect.objectContaining({
          message: expect.objectContaining({
            title: messageData.title,
          }),
        })
      );
    });

    it("should handle multiple users in targeted messages", async () => {
      const messageData = {
        title: "Broadcast Test Message",
        content: "Testing multiple user targeting",
        type: "announcement",
        priority: "high",
      };

      const creator = {
        id: adminUser._id.toString(),
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        username: adminUser.username,
        gender: adminUser.gender || "male",
        authLevel: adminUser.role,
        roleInAtCloud: adminUser.roleInAtCloud,
      };

      const userIds = [testUser._id.toString(), adminUser._id.toString()];

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        messageData,
        userIds,
        creator
      );

      expect(result).toBeDefined();
      expect(result.title).toBe(messageData.title);

      // Verify message was created in database
      const savedMessage = await Message.findById(result._id);
      expect(savedMessage).toBeDefined();

      // Verify WebSocket emissions were called for both users
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalledTimes(2);
    });

    it("should validate creator information is properly stored", async () => {
      const messageData = {
        title: "Creator Test Message",
        content: "Testing creator information storage",
        type: "update",
        priority: "low",
      };

      const creator = {
        id: adminUser._id.toString(),
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        username: adminUser.username,
        gender: adminUser.gender || "male",
        authLevel: adminUser.role,
        roleInAtCloud: adminUser.roleInAtCloud,
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        messageData,
        [testUser._id.toString()],
        creator
      );

      expect(result).toBeDefined();
      expect(result.creator).toBeDefined();
      expect(result.creator.id).toBe(creator.id);
      expect(result.creator.firstName).toBe(creator.firstName);
      expect(result.creator.authLevel).toBe(creator.authLevel);
    });

    it("should validate message recipients are properly set", async () => {
      const messageData = {
        title: "Recipients Test Message",
        content: "Testing recipient validation",
        type: "update", // Using valid enum value
        priority: "medium",
      };

      const userIds = [testUser._id.toString()];

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        messageData,
        userIds
      );

      expect(result).toBeDefined();
      expect(result.userStates).toBeDefined();
      expect(result.userStates.size).toBe(1);
      expect(result.userStates.has(testUser._id.toString())).toBe(true);

      const userState = result.userStates.get(testUser._id.toString());
      expect(userState.isReadInSystem).toBe(false);
      expect(userState.isReadInBell).toBe(false);
    });
  });

  describe("🛡️ ERROR HANDLING", () => {
    it("should handle invalid user IDs gracefully", async () => {
      const messageData = {
        title: "Invalid User Test",
        content: "Testing with invalid user ID",
        type: "announcement",
        priority: "medium",
      };

      const invalidUserId = new mongoose.Types.ObjectId().toString();

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        messageData,
        [invalidUserId]
      );

      expect(result).toBeDefined();
      // Should still create the message even if user doesn't exist
      expect(result.title).toBe(messageData.title);
    });

    it("should handle empty user array", async () => {
      const messageData = {
        title: "Empty Users Test",
        content: "Testing with empty user array",
        type: "announcement",
        priority: "medium",
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        messageData,
        []
      );

      expect(result).toBeDefined();
      expect(result.userStates).toBeDefined();
      expect(result.userStates.size).toBe(0);
    });
  });
});
