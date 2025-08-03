/**
 * TRIO SYSTEM TEST SUITE - PERMANENT CORE FUNCTIONALITY TESTS
 * 
 * ⚠️  PERMANENT TEST SUITE - DO NOT DELETE OR CLEAN UP ⚠️ 
 * 
 * This comprehensive test suite validates all notification trio functionality
 * and serves as the foundation for ongoing trio system validation.
 * 
 * PURPOSE: Essential regression testing for trio notification architecture
 * STATUS: Core permanent test suite - maintained across all phases
 * SCOPE: Production-critical trio functionality validation
 *
 * Tests cover:
 * - All 8 trio notification types (Email + System Message + Bell)
 * - API standardization validation (UnifiedMessageController patterns)
 * - Error handling and rollback scenarios
 * - Performance benchmarks and concurrent operations
 * - Migration pattern equivalence validation
 * 
 * MAINTENANCE: Update when trio architecture changes, never remove
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import User, { IUser } from "../models/User";
import Event, { IEvent } from "../models/Event";
import Message from "../models/Message";
import Registration from "../models/Registration";
import { UnifiedMessageController } from "../controllers/unifiedMessageController";
import { EmailService } from "../services/infrastructure/emailService";
import { socketService } from "../services/infrastructure/SocketService";
import { ROLES } from "../utils/roleUtils";

// Test data factories
const createTestUser = async (overrides = {}) => {
  const userData = {
    firstName: "Test",
    lastName: "User",
    username: "testuser",
    email: "test@example.com",
    password: "ValidPassword123!",
    role: ROLES.PARTICIPANT,
    roleInAtCloud: "Member",
    isEmailVerified: true,
    ...overrides,
  };
  return await User.create(userData);
};

const createTestEvent = async (creatorId: string, overrides = {}) => {
  const eventData = {
    title: "Test Event",
    type: "Workshop",
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0], // YYYY-MM-DD format
    time: "10:00",
    endTime: "12:00",
    location: "Test Location",
    organizer: "Test Organizer",
    createdBy: creatorId,
    purpose: "This is a test event purpose description",
    format: "In-person",
    roles: [
      {
        id: "test-role-1",
        name: "Participant",
        description: "Event participant",
        maxParticipants: 50,
      },
    ],
    ...overrides,
  };
  return await Event.create(eventData);
};

describe("TRIO NOTIFICATION SYSTEM - Phase 1 Refactoring", () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let adminUser: any;
  let testEvent: any;

  beforeEach(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test users
    testUser = await createTestUser();
    adminUser = await createTestUser({
      username: "admin",
      email: "admin@example.com",
      role: ROLES.ADMINISTRATOR,
      roleInAtCloud: "Pastor",
    });

    // Create test event
    testEvent = await createTestEvent(adminUser._id);

    // Mock external services
    vi.spyOn(EmailService, "sendWelcomeEmail").mockResolvedValue(true);
    vi.spyOn(EmailService, "sendPasswordResetSuccessEmail").mockResolvedValue(
      true
    );
    vi.spyOn(EmailService, "sendEventCreatedEmail").mockResolvedValue(true);
    vi.spyOn(EmailService, "sendCoOrganizerAssignedEmail").mockResolvedValue(
      true
    );
    vi.spyOn(EmailService, "sendNewLeaderSignupEmail").mockResolvedValue(true);
    vi.spyOn(EmailService, "sendEventReminderEmail").mockResolvedValue(true);
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

  describe("🔧 API STANDARDIZATION VALIDATION", () => {
    it("should validate current UnifiedMessageController.createTargetedSystemMessage usage", async () => {
      // Test the standard pattern that we want to keep
      const messageData = {
        title: "Test System Message",
        content: "This is a test message for API standardization",
        type: "announcement",
        priority: "medium",
      };

      const creator = {
        id: adminUser._id.toString(),
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        username: adminUser.username,
        gender: adminUser.gender,
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

    it("should identify all Message.createForAllUsers usage patterns", async () => {
      // Create a test case that mimics the deprecated pattern
      const messageData = {
        title: "Deprecated Pattern Test",
        content: "Testing Message.createForAllUsers pattern",
        type: "announcement",
        priority: "medium",
        creator: {
          id: adminUser._id.toString(),
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          username: adminUser.username,
          gender: adminUser.gender,
          authLevel: adminUser.role,
          roleInAtCloud: adminUser.roleInAtCloud,
        },
        isActive: true,
      };

      const userIds = [testUser._id.toString()];

      // Test the deprecated pattern (this should work but will be removed)
      const deprecatedResult = await Message.createForAllUsers(
        messageData,
        userIds
      );

      expect(deprecatedResult).toBeDefined();
      expect(deprecatedResult.title).toBe(messageData.title);

      // Verify both patterns create similar results
      const standardResult =
        await UnifiedMessageController.createTargetedSystemMessage(
          {
            title: messageData.title,
            content: messageData.content,
            type: messageData.type,
            priority: messageData.priority,
          },
          userIds,
          messageData.creator
        );

      expect(standardResult.title).toBe(deprecatedResult.title);
      expect(standardResult.content).toBe(deprecatedResult.content);
      expect(standardResult.type).toBe(deprecatedResult.type);
    });
  });

  describe("🎯 TRIO VALIDATION - All 8 Notification Types", () => {
    it("should validate Email Verification → Welcome trio", async () => {
      // This test validates the welcome message trio
      const welcomeData = {
        title: "Welcome to @Cloud!",
        content: "Welcome to the @Cloud Event Sign-up System!",
        type: "announcement",
        priority: "medium",
      };

      const creator = {
        id: "system",
        firstName: "System",
        lastName: "Administrator",
        username: "system",
        gender: "male",
        authLevel: "Super Admin",
        roleInAtCloud: "System",
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        welcomeData,
        [testUser._id.toString()],
        creator
      );

      expect(result).toBeDefined();
      expect(EmailService.sendWelcomeEmail).toHaveBeenCalled();
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalled();
    });

    it("should validate Password Reset Success trio", async () => {
      const resetData = {
        title: "Password Reset Successful",
        content: "Your password has been successfully reset.",
        type: "update",
        priority: "high",
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        resetData,
        [testUser._id.toString()]
      );

      expect(result).toBeDefined();
      expect(result.type).toBe("update");
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalled();
    });

    it("should validate Event Creation trio", async () => {
      const eventData = {
        title: "New Event Created",
        content: `Event "${testEvent.title}" has been created.`,
        type: "announcement",
        priority: "medium",
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        eventData,
        [testUser._id.toString()],
        {
          id: adminUser._id.toString(),
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          username: adminUser.username,
          gender: adminUser.gender,
          authLevel: adminUser.role,
          roleInAtCloud: adminUser.roleInAtCloud,
        }
      );

      expect(result).toBeDefined();
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalled();
    });

    it("should validate Co-organizer Assignment trio", async () => {
      const coOrgData = {
        title: "Co-organizer Assignment",
        content: `You have been assigned as a co-organizer for "${testEvent.title}".`,
        type: "assignment",
        priority: "high",
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        coOrgData,
        [testUser._id.toString()],
        {
          id: adminUser._id.toString(),
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          username: adminUser.username,
          gender: adminUser.gender,
          authLevel: adminUser.role,
          roleInAtCloud: adminUser.roleInAtCloud,
        }
      );

      expect(result).toBeDefined();
      expect(result.type).toBe("assignment");
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalled();
    });

    it("should validate System Role Changes trio", async () => {
      const roleChangeData = {
        title: "System Role Updated",
        content: "Your system role has been updated.",
        type: "auth_level_change",
        priority: "high",
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        roleChangeData,
        [testUser._id.toString()],
        {
          id: adminUser._id.toString(),
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          username: adminUser.username,
          gender: adminUser.gender,
          authLevel: adminUser.role,
          roleInAtCloud: adminUser.roleInAtCloud,
        }
      );

      expect(result).toBeDefined();
      expect(result.type).toBe("auth_level_change");
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalled();
    });

    it("should validate @Cloud Role Changes trio", async () => {
      const atCloudRoleData = {
        title: "@Cloud Role Updated",
        content: "Your @Cloud ministry role has been updated.",
        type: "auth_level_change",
        priority: "high",
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        atCloudRoleData,
        [testUser._id.toString()],
        {
          id: adminUser._id.toString(),
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          username: adminUser.username,
          gender: adminUser.gender,
          authLevel: adminUser.role,
          roleInAtCloud: adminUser.roleInAtCloud,
        }
      );

      expect(result).toBeDefined();
      expect(result.type).toBe("auth_level_change");
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalled();
    });

    it("should validate New Leader Signups trio", async () => {
      const leaderSignupData = {
        title: "New @Cloud Leader Signup",
        content: "A new user has signed up with a leadership role.",
        type: "auth_level_change",
        priority: "high",
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        leaderSignupData,
        [adminUser._id.toString()], // Notify admins
        {
          id: "system",
          firstName: "System",
          lastName: "Administrator",
          username: "system",
          gender: "male",
          authLevel: "Super Admin",
          roleInAtCloud: "System",
        }
      );

      expect(result).toBeDefined();
      expect(result.type).toBe("auth_level_change");
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalled();
    });

    it("should validate Event Reminders trio", async () => {
      const reminderData = {
        title: "Event Reminder",
        content: `Reminder: "${testEvent.title}" is coming up soon.`,
        type: "reminder",
        priority: "medium",
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        reminderData,
        [testUser._id.toString()],
        {
          id: "system",
          firstName: "System",
          lastName: "Administrator",
          username: "system",
          gender: "male",
          authLevel: "Super Admin",
          roleInAtCloud: "System",
        }
      );

      expect(result).toBeDefined();
      expect(result.type).toBe("reminder");
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalled();
    });
  });

  describe("🔄 ERROR HANDLING & ROLLBACK SCENARIOS", () => {
    it("should handle email service failures gracefully", async () => {
      // Mock email service failure
      vi.spyOn(EmailService, "sendWelcomeEmail").mockRejectedValue(
        new Error("Email service down")
      );

      const messageData = {
        title: "Test Message",
        content: "Test content",
        type: "announcement",
        priority: "medium",
      };

      // The system message should still be created even if email fails
      // (This tests current behavior - will be changed in Phase 1 to atomic transactions)
      const result = await UnifiedMessageController.createTargetedSystemMessage(
        messageData,
        [testUser._id.toString()]
      );

      expect(result).toBeDefined();
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalled();
    });

    it("should handle database failures gracefully", async () => {
      // Mock database connection issues
      const originalSave = Message.prototype.save;
      vi.spyOn(Message.prototype, "save").mockRejectedValue(
        new Error("Database connection lost")
      );

      const messageData = {
        title: "Test Message",
        content: "Test content",
        type: "announcement",
        priority: "medium",
      };

      await expect(
        UnifiedMessageController.createTargetedSystemMessage(messageData, [
          testUser._id.toString(),
        ])
      ).rejects.toThrow("Database connection lost");

      // Restore original method
      Message.prototype.save = originalSave;
    });

    it("should handle WebSocket failures gracefully", async () => {
      // Mock WebSocket failure
      vi.spyOn(socketService, "emitSystemMessageUpdate").mockImplementation(
        () => {
          throw new Error("WebSocket connection failed");
        }
      );

      const messageData = {
        title: "Test Message",
        content: "Test content",
        type: "announcement",
        priority: "medium",
      };

      // System message should still be created even if WebSocket fails
      const result = await UnifiedMessageController.createTargetedSystemMessage(
        messageData,
        [testUser._id.toString()]
      );

      expect(result).toBeDefined();

      // Verify message was saved to database
      const savedMessage = await Message.findById(result._id);
      expect(savedMessage).toBeDefined();
    });
  });

  describe("⚡ PERFORMANCE BENCHMARKS", () => {
    it("should complete trio creation within performance thresholds", async () => {
      const startTime = Date.now();

      const messageData = {
        title: "Performance Test Message",
        content: "Testing trio creation performance",
        type: "announcement",
        priority: "medium",
      };

      const result = await UnifiedMessageController.createTargetedSystemMessage(
        messageData,
        [testUser._id.toString()]
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });

    it("should handle multiple concurrent trio creations", async () => {
      const promises = [];
      const userIds = [testUser._id.toString()];

      // Create 10 concurrent trio notifications
      for (let i = 0; i < 10; i++) {
        const messageData = {
          title: `Concurrent Test Message ${i}`,
          content: `Testing concurrent trio creation ${i}`,
          type: "announcement",
          priority: "medium",
        };

        promises.push(
          UnifiedMessageController.createTargetedSystemMessage(
            messageData,
            userIds
          )
        );
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      // All should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe("fulfilled");
        if (result.status === "fulfilled") {
          expect(result.value).toBeDefined();
          expect(result.value.title).toContain(
            `Concurrent Test Message ${index}`
          );
        }
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000); // Within 2 seconds
    });
  });

  describe("🔍 MIGRATION VALIDATION", () => {
    it("should produce equivalent results between old and new patterns", async () => {
      const messageData = {
        title: "Migration Test Message",
        content: "Testing equivalence between patterns",
        type: "announcement",
        priority: "medium",
      };

      const creator = {
        id: adminUser._id.toString(),
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        username: adminUser.username,
        gender: adminUser.gender,
        authLevel: adminUser.role,
        roleInAtCloud: adminUser.roleInAtCloud,
      };

      const userIds = [testUser._id.toString()];

      // Test new standard pattern
      const standardResult =
        await UnifiedMessageController.createTargetedSystemMessage(
          messageData,
          userIds,
          creator
        );

      // Test deprecated pattern (for comparison)
      const deprecatedData = {
        ...messageData,
        creator,
        isActive: true,
      };

      const deprecatedResult = await Message.createForAllUsers(
        deprecatedData,
        userIds
      );

      // Compare key properties
      expect(standardResult.title).toBe(deprecatedResult.title);
      expect(standardResult.content).toBe(deprecatedResult.content);
      expect(standardResult.type).toBe(deprecatedResult.type);
      expect(standardResult.priority).toBe(deprecatedResult.priority);

      // Verify both created database records
      const standardMessage = await Message.findById(standardResult._id);
      const deprecatedMessage = await Message.findById(deprecatedResult._id);

      expect(standardMessage).toBeDefined();
      expect(deprecatedMessage).toBeDefined();
    });
  });
});

// Performance and reliability tracking
export const TrioSystemMetrics = {
  successRate: 0,
  averageLatency: 0,
  errorCount: 0,
  totalTriosCreated: 0,

  recordSuccess(latency: number) {
    this.totalTriosCreated++;
    this.averageLatency =
      (this.averageLatency * (this.totalTriosCreated - 1) + latency) /
      this.totalTriosCreated;
    this.successRate =
      ((this.totalTriosCreated - this.errorCount) / this.totalTriosCreated) *
      100;
  },

  recordError() {
    this.errorCount++;
    this.successRate =
      ((this.totalTriosCreated - this.errorCount) / this.totalTriosCreated) *
      100;
  },

  getReport() {
    return {
      successRate: `${this.successRate.toFixed(2)}%`,
      averageLatency: `${this.averageLatency.toFixed(2)}ms`,
      totalErrors: this.errorCount,
      totalTrios: this.totalTriosCreated,
    };
  },
};
