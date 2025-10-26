/**
 * Unit Tests for TrioNotificationService
 *
 * Tests the core functionality of the enhanced trio notification system
 * including atomic operations, rollback mechanisms, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TrioNotificationService } from "../../../../src/services/notifications/TrioNotificationService";
import { TrioTransaction } from "../../../../src/services/notifications/TrioTransaction";
import { NotificationErrorHandler } from "../../../../src/services/notifications/NotificationErrorHandler";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

// Mock all models to prevent Mongoose compilation conflicts
vi.mock("../../../../src/models/User", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    }),
    findById: vi.fn().mockResolvedValue(null),
    findOne: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../../../src/models/Event", () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    updateMany: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../../../../src/models/Registration", () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    updateMany: vi.fn(),
    countDocuments: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("../../../../src/models/Message", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
  },
}));

// Mock dependencies
vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendWelcomeEmail: vi.fn(),
    sendPasswordResetSuccessEmail: vi.fn(),
    sendEventReminderEmail: vi.fn(),
  },
}));
vi.mock("../../../../src/controllers/unifiedMessageController");
vi.mock("../../../../src/services/infrastructure/SocketService");
vi.mock("../../../../src/services/notifications/NotificationErrorHandler");

describe("TrioNotificationService", () => {
  beforeEach(() => {
    // Reset metrics before each test
    TrioNotificationService.resetMetrics();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Ensure real timers are restored after each test
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createTrio", () => {
    it("should successfully create a complete trio with all components", async () => {
      // Arrange
      const mockMessageResult = {
        _id: { toString: () => "message-456" },
        toJSON: () => ({ id: "message-456", title: "Test", content: "Test" }),
        save: vi.fn().mockResolvedValue(undefined),
        isActive: true,
      };

      // Mock successful operations
      vi.mocked(EmailService.sendWelcomeEmail).mockResolvedValue(true);
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(mockMessageResult as any);
      vi.mocked(socketService.emitSystemMessageUpdate).mockResolvedValue(
        undefined
      );

      const request = {
        email: {
          to: "test@example.com",
          template: "welcome" as const,
          data: { name: "Test User" },
          priority: "high" as const,
        },
        systemMessage: {
          title: "Welcome!",
          content: "Welcome to the system",
          type: "announcement",
          priority: "medium",
        },
        recipients: ["user1", "user2"],
      };

      // Act
      const result = await TrioNotificationService.createTrio(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.emailId).toBeUndefined(); // EmailService returns boolean, not object with id
      expect(result.messageId).toBe("message-456");
      expect(result.notificationsSent).toBe(2);
      expect(result.metrics).toMatchObject({
        duration: expect.any(Number),
        emailTime: expect.any(Number),
        messageTime: expect.any(Number),
        socketTime: expect.any(Number),
      });

      // Verify all services were called
      expect(EmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        "test@example.com",
        "Test User"
      );
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledWith(
        request.systemMessage,
        request.recipients,
        undefined
      );
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalledTimes(2);
    });

    it("should handle email-only trio (no email provided)", async () => {
      // Arrange
      const mockMessageResult = {
        _id: { toString: () => "message-456" } as any,
        toJSON: () => ({
          id: "message-456",
          title: "Alert",
          content: "Important message",
        }),
        save: vi.fn().mockResolvedValue(undefined),
        isActive: true,
      };

      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(mockMessageResult as any);
      vi.mocked(socketService.emitSystemMessageUpdate).mockResolvedValue(
        undefined
      );

      const request = {
        systemMessage: {
          title: "System Alert",
          content: "Important system message",
          type: "alert",
          priority: "high",
        },
        recipients: ["user1"],
      };

      // Act
      const result = await TrioNotificationService.createTrio(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.emailId).toBeUndefined();
      expect(result.messageId).toBe("message-456");
      expect(result.notificationsSent).toBe(1);

      // Verify email service was not called
      expect(EmailService.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it("should rollback operations on failure when rollback is enabled", async () => {
      // Arrange
      const mockMessageResult = {
        _id: { toString: () => "message-456" } as any,
        toJSON: () => ({ id: "message-456", title: "Test", content: "Test" }),
        save: vi.fn().mockResolvedValue(undefined),
        isActive: true,
      };

      // Mock system message creation to fail after email succeeds
      vi.mocked(EmailService.sendWelcomeEmail).mockResolvedValue(true);
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockRejectedValue(new Error("Database error"));

      vi.mocked(NotificationErrorHandler.handleTrioFailure).mockResolvedValue({
        success: false,
        action: "log-only",
        message: "Logged error for manual review",
      });

      const request = {
        email: {
          to: "test@example.com",
          template: "welcome" as const,
          data: { name: "Test User" },
        },
        systemMessage: {
          title: "Welcome!",
          content: "Welcome to the system",
        },
        recipients: ["user1"],
        options: {
          enableRollback: true,
        },
      };

      // Act
      const result = await TrioNotificationService.createTrio(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.rollbackCompleted).toBe(true);
      expect(result.error).toContain("System message creation failed");

      // Verify error handler was called
      expect(NotificationErrorHandler.handleTrioFailure).toHaveBeenCalled();
    });

    it("should handle email timeout with retry logic", async () => {
      // Use fake timers to speed up retry delays
      vi.useFakeTimers();

      // Test that the service properly handles retries by expecting it to fail
      // after multiple attempts (testing the failure path with retry logic)
      vi.mocked(EmailService.sendWelcomeEmail).mockRejectedValue(
        new Error("Service unavailable")
      );

      const mockMessageResult = {
        _id: { toString: () => "message-456" } as any,
        toJSON: () => ({ id: "message-456", title: "Test", content: "Test" }),
        save: vi.fn().mockResolvedValue(undefined),
        isActive: true,
      };
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(mockMessageResult as any);
      vi.mocked(socketService.emitSystemMessageUpdate).mockResolvedValue(
        undefined
      );

      const request = {
        email: {
          to: "test@example.com",
          template: "welcome" as const,
          data: { name: "Test User" },
        },
        systemMessage: {
          title: "Welcome!",
          content: "Welcome to the system",
        },
        recipients: ["user1"],
      };

      // Start the trio creation (this will use fake timers for retries)
      const resultPromise = TrioNotificationService.createTrio(request);

      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      // Should fail due to email service being unavailable
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // But should have attempted the email multiple times (retry logic)
      expect(EmailService.sendWelcomeEmail).toHaveBeenCalledTimes(3);

      // Restore real timers
      vi.useRealTimers();
    });

    it("should update metrics correctly on success and failure", async () => {
      // Test successful trio
      const mockMessageResult = {
        _id: { toString: () => "message-456" } as any,
        toJSON: () => ({ id: "message-456", title: "Test", content: "Test" }),
        save: vi.fn().mockResolvedValue(undefined),
        isActive: true,
      };
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(mockMessageResult as any);
      vi.mocked(socketService.emitSystemMessageUpdate).mockResolvedValue(
        undefined
      );

      await TrioNotificationService.createTrio({
        systemMessage: { title: "Test", content: "Test" },
        recipients: ["user1"],
      });

      let metrics = TrioNotificationService.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulTrios).toBe(1);
      expect(metrics.failedTrios).toBe(0);

      // Test failed trio
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockRejectedValue(new Error("DB Error"));
      vi.mocked(NotificationErrorHandler.handleTrioFailure).mockResolvedValue({
        success: false,
        action: "log-only",
        message: "Logged database error for manual review",
      });

      await TrioNotificationService.createTrio({
        systemMessage: { title: "Test", content: "Test" },
        recipients: ["user1"],
      });

      metrics = TrioNotificationService.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulTrios).toBe(1);
      expect(metrics.failedTrios).toBe(1);
      expect(metrics.rollbackCount).toBe(1); // Rollback should have been attempted
    });
  });

  describe("convenience methods", () => {
    beforeEach(() => {
      // Mock successful operations for convenience method tests
      vi.mocked(EmailService.sendWelcomeEmail).mockResolvedValue(true);
      vi.mocked(EmailService.sendPasswordResetSuccessEmail).mockResolvedValue(
        true
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue({
        _id: { toString: () => "message-456" } as any,
        toJSON: () => ({ id: "message-456", title: "Test", content: "Test" }),
        save: vi.fn().mockResolvedValue(undefined),
        isActive: true,
      } as any);
      vi.mocked(socketService.emitSystemMessageUpdate).mockResolvedValue(
        undefined
      );
    });

    it("should create welcome trio with correct parameters", async () => {
      // Act
      const result = await TrioNotificationService.createWelcomeTrio(
        "test@example.com",
        "Test User",
        "user123"
      );

      // Assert
      expect(result.success).toBe(true);
      expect(EmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        "test@example.com",
        "Test User"
      );
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledWith(
        {
          title: "Welcome to @Cloud!",
          content:
            "Welcome to the @Cloud Event Sign-up System! Your account has been verified and you can now participate in events.",
          type: "announcement",
          priority: "medium",
          hideCreator: true,
        },
        ["user123"],
        undefined
      );
    });

    it("should create password reset success trio with correct parameters", async () => {
      // Act
      const result =
        await TrioNotificationService.createPasswordResetSuccessTrio(
          "test@example.com",
          "Test User",
          "user123"
        );

      // Assert
      expect(result.success).toBe(true);
      expect(EmailService.sendPasswordResetSuccessEmail).toHaveBeenCalledWith(
        "test@example.com",
        "Test User"
      );
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledWith(
        {
          title: "Password Reset Successful",
          content:
            "Your password has been successfully reset. You can now log in with your new password.",
          type: "update",
          priority: "high",
          hideCreator: true,
        },
        ["user123"],
        undefined
      );
    });

    it("should create event reminder trio with correct parameters", async () => {
      // Arrange
      const mockEvent = {
        title: "Test Event",
        date: "2025-08-10",
        time: "14:00",
      };
      const mockUser = {
        _id: { toString: () => "user123" },
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      };

      // Act
      const result = await TrioNotificationService.createEventReminderTrio(
        mockEvent,
        mockUser
      );

      // Assert
      expect(result.success).toBe(true);
      expect(EmailService.sendEventReminderEmail).toHaveBeenCalledWith(
        mockEvent,
        mockUser,
        "upcoming",
        "24 hours"
      );
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledWith(
        {
          title: "Event Reminder",
          content:
            'Reminder: "Test Event" is coming up soon. Don\'t forget to prepare!',
          type: "announcement",
          priority: "medium",
          hideCreator: true,
        },
        ["user123"],
        undefined
      );
    });
  });

  describe("metrics and monitoring", () => {
    it("should track performance metrics correctly", async () => {
      // Arrange
      const mockMessageResult = {
        _id: { toString: () => "message-456" } as any,
        toJSON: () => ({ id: "message-456", title: "Test", content: "Test" }),
        save: vi.fn().mockResolvedValue(undefined),
        isActive: true,
      };
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(mockMessageResult as any);
      vi.mocked(socketService.emitSystemMessageUpdate).mockResolvedValue(
        undefined
      );

      // Act
      const result = await TrioNotificationService.createTrio({
        systemMessage: { title: "Test", content: "Test" },
        recipients: ["user1"],
      });

      // Assert
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.duration).toBeGreaterThanOrEqual(0);
      expect(result.metrics?.messageTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics?.socketTime).toBeGreaterThanOrEqual(0);

      const metrics = TrioNotificationService.getMetrics();
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.totalRequests).toBe(1);
    });

    it("should reset metrics correctly", () => {
      // Create a trio to populate metrics
      TrioNotificationService.resetMetrics();

      const metrics = TrioNotificationService.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulTrios).toBe(0);
      expect(metrics.failedTrios).toBe(0);
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.rollbackCount).toBe(0);
      expect(Object.keys(metrics.errorsByType)).toHaveLength(0);
    });
  });
});
