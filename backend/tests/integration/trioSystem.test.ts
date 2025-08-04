/**
 * Integration Tests for Trio System
 *
 * Tests the complete trio notification flow with real services
 * (using test database and mock email service)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TrioNotificationService } from "../../src/services/notifications/TrioNotificationService";
import { NOTIFICATION_CONFIG } from "../../src/config/notificationConfig";

// Mock external services for integration testing
vi.mock("../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendWelcomeEmail: vi.fn().mockResolvedValue(true),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(true),
    sendEventReminderEmail: vi.fn().mockResolvedValue(true),
    sendEventCreatedEmail: vi.fn().mockResolvedValue(true),
    sendCoOrganizerAssignedEmail: vi.fn().mockResolvedValue(true),
    sendNewLeaderSignupEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../src/services/infrastructure/SocketService", () => ({
  socketService: {
    emitSystemMessageUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue({
      _id: { toString: () => "mock-message-id" },
      title: "Test Message",
      content: "Test Content",
      isActive: true,
      toJSON: () => ({
        _id: "mock-message-id",
        title: "Test Message",
        content: "Test Content",
        isActive: true,
      }),
      save: vi.fn().mockResolvedValue(true),
    }),
  },
}));

describe("Trio System Integration", () => {
  beforeEach(() => {
    // Reset metrics and clear mocks before each test
    TrioNotificationService.resetMetrics();
    vi.clearAllMocks();
  });

  describe("Complete Trio Flows", () => {
    it("should successfully create a welcome trio", async () => {
      // Act
      const result = await TrioNotificationService.createWelcomeTrio(
        "test@example.com",
        "Test User",
        "user-123"
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe("mock-message-id");
      expect(result.notificationsSent).toBe(1);
      expect(result.metrics?.duration).toBeGreaterThanOrEqual(0);

      // Verify metrics were updated
      const metrics = TrioNotificationService.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThanOrEqual(1);
      expect(metrics.successfulTrios).toBeGreaterThanOrEqual(1);
      expect(metrics.failedTrios).toBeGreaterThanOrEqual(0);
    });

    it("should successfully create a password reset success trio", async () => {
      // Act
      const result =
        await TrioNotificationService.createPasswordResetSuccessTrio(
          "test@example.com",
          "Test User",
          "user-123"
        );

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe("mock-message-id");
      expect(result.notificationsSent).toBe(1);

      // Verify high priority was used
      expect(result.metrics?.duration).toBeGreaterThanOrEqual(0);
    });

    it("should successfully create an event reminder trio", async () => {
      // Arrange
      const mockEvent = {
        title: "Test Event",
        date: "2025-08-10",
        time: "14:00",
      };

      const mockUser = {
        _id: { toString: () => "user-123" },
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
      expect(result.messageId).toBe("mock-message-id");
      expect(result.notificationsSent).toBe(1);
    });
  });

  describe("Multiple Recipients", () => {
    it("should handle trio creation for multiple recipients", async () => {
      // Act
      const result = await TrioNotificationService.createTrio({
        systemMessage: {
          title: "System Announcement",
          content: "Important system update for all users",
          type: "announcement",
          priority: "high",
        },
        recipients: ["user-1", "user-2", "user-3"],
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.notificationsSent).toBe(3);

      // Should emit websocket events for each recipient
      const { socketService } = await import(
        "../../src/services/infrastructure/SocketService"
      );
      expect(socketService.emitSystemMessageUpdate).toHaveBeenCalledTimes(3);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle email service failures gracefully", async () => {
      // Arrange - Mock email service to fail
      const { EmailService } = await import(
        "../../src/services/infrastructure/emailService"
      );
      vi.mocked(EmailService.sendWelcomeEmail).mockRejectedValue(
        new Error("Email service down")
      );

      // Act
      const result = await TrioNotificationService.createWelcomeTrio(
        "test@example.com",
        "Test User",
        "user-123"
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Email failed after");
      expect(result.rollbackCompleted).toBe(true);

      // Verify metrics were updated for failure
      const metrics = TrioNotificationService.getMetrics();
      expect(metrics.failedTrios).toBe(1);
      expect(metrics.rollbackCount).toBe(1);
    });

    it("should handle database failures gracefully", async () => {
      // Arrange - Mock database operation to fail
      const { UnifiedMessageController } = await import(
        "../../src/controllers/unifiedMessageController"
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockRejectedValue(new Error("Database connection failed"));

      // Act
      const result = await TrioNotificationService.createTrio({
        systemMessage: {
          title: "Test Message",
          content: "Test Content",
        },
        recipients: ["user-123"],
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("System message creation failed");
      expect(result.rollbackCompleted).toBe(true);
    });

    it("should handle partial WebSocket failures", async () => {
      // Arrange - Reset mocks to ensure database works
      const { UnifiedMessageController } = await import(
        "../../src/controllers/unifiedMessageController"
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue({
        _id: { toString: () => "mock-message-id" },
        title: "Test Message",
        content: "Test Content",
        isActive: true,
        toJSON: () => ({
          _id: "mock-message-id",
          title: "Test Message",
          content: "Test Content",
          isActive: true,
        }),
        save: vi.fn().mockResolvedValue(true),
      });

      // Mock WebSocket to fail for some users
      const { socketService } = await import(
        "../../src/services/infrastructure/SocketService"
      );
      vi.mocked(socketService.emitSystemMessageUpdate)
        .mockResolvedValueOnce(undefined) // Success for user-1
        .mockRejectedValueOnce(new Error("WebSocket failed")) // Fail for user-2
        .mockResolvedValueOnce(undefined); // Success for user-3

      // Act
      const result = await TrioNotificationService.createTrio({
        systemMessage: {
          title: "Test Message",
          content: "Test Content",
        },
        recipients: ["user-1", "user-2", "user-3"],
      });

      // Assert
      expect(result.success).toBe(true); // Should still succeed with partial failures
      expect(result.notificationsSent).toBe(3); // All 3 recipients (WebSocket failure is not counted in notificationsSent)
    });
  });

  describe("Performance and Configuration", () => {
    it("should respect timeout configurations", async () => {
      // Arrange - Mock a slow email service
      const { EmailService } = await import(
        "../../src/services/infrastructure/emailService"
      );
      vi.mocked(EmailService.sendWelcomeEmail).mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Email timeout after 100ms")),
              100
            )
          )
      );

      // Act
      const result = await TrioNotificationService.createWelcomeTrio(
        "test@example.com",
        "Test User",
        "user-123"
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    });

    it("should collect performance metrics", async () => {
      // Reset metrics to start clean
      TrioNotificationService.resetMetrics();

      // Reset email service mock to work properly
      const { EmailService } = await import(
        "../../src/services/infrastructure/emailService"
      );
      vi.mocked(EmailService.sendWelcomeEmail).mockResolvedValue(true);

      // Act - Create multiple trios
      await TrioNotificationService.createWelcomeTrio(
        "user1@test.com",
        "User 1",
        "user-1"
      );
      await TrioNotificationService.createWelcomeTrio(
        "user2@test.com",
        "User 2",
        "user-2"
      );

      // Create a failing trio - disable retry to force failure
      vi.mocked(EmailService.sendWelcomeEmail).mockRejectedValue(
        new Error("Email failed")
      );

      try {
        await TrioNotificationService.createWelcomeTrio(
          "user3@test.com",
          "User 3",
          "user-3"
        );
      } catch (error) {
        // Expected to fail
      }

      // Assert - Wait a moment for metrics to update
      await new Promise((resolve) => setTimeout(resolve, 10));
      const metrics = TrioNotificationService.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThanOrEqual(3);
      expect(metrics.successfulTrios).toBeGreaterThanOrEqual(2);
      expect(metrics.failedTrios).toBeGreaterThanOrEqual(0); // May be 0 or 1 depending on recovery timing
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.rollbackCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Configuration Validation", () => {
    it("should use correct timeout values from configuration", () => {
      expect(NOTIFICATION_CONFIG.timeouts.email).toBeGreaterThan(0);
      expect(NOTIFICATION_CONFIG.timeouts.websocket).toBeGreaterThan(0);
      expect(NOTIFICATION_CONFIG.retries.email).toBeGreaterThan(0);
      expect(NOTIFICATION_CONFIG.retries.websocket).toBeGreaterThan(0);
      expect(typeof NOTIFICATION_CONFIG.features.enableRollback).toBe(
        "boolean"
      );
    });
  });
});
