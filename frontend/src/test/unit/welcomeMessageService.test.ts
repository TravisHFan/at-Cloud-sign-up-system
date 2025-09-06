/**
 * Welcome Message Service Unit Tests
 * Tests for frontend welcome message service functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the systemMessageService before any imports
vi.mock("../../services/api", () => ({
  systemMessageService: {
    sendWelcomeNotification: vi.fn(),
    checkWelcomeMessageStatus: vi.fn(),
  },
}));

// Import the service after mocking
import {
  sendWelcomeMessage,
  hasWelcomeMessageBeenSent,
} from "../../utils/welcomeMessageService";
import { systemMessageService } from "../../services/api";

describe("Welcome Message Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("sendWelcomeMessage", () => {
    it("should send welcome notification for first login", async () => {
      // Arrange
      vi.mocked(systemMessageService.sendWelcomeNotification).mockResolvedValue(
        undefined
      );

      // Act
      await sendWelcomeMessage(undefined, true);

      // Assert
      expect(
        vi.mocked(systemMessageService.sendWelcomeNotification)
      ).toHaveBeenCalledTimes(1);
    });

    it("should not send welcome notification for non-first login", async () => {
      // Arrange
      vi.mocked(systemMessageService.sendWelcomeNotification).mockResolvedValue(
        undefined
      );

      // Act
      await sendWelcomeMessage(undefined, false);

      // Assert
      expect(
        vi.mocked(systemMessageService.sendWelcomeNotification)
      ).not.toHaveBeenCalled();
    });

    it("should surface API errors and log when sending welcome notification fails", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(systemMessageService.sendWelcomeNotification).mockRejectedValue(
        new Error("API Error")
      );

      // Act + Assert: function rethrows so callers can handle it
      await expect(sendWelcomeMessage(undefined, true)).rejects.toThrow(
        "API Error"
      );

      // And it logs an error with a helpful message (emoji allowed)
      expect(consoleErrorSpy).toHaveBeenCalled();
      const firstCall = consoleErrorSpy.mock.calls[0];
      expect(firstCall[0]).toContain("Failed to send welcome notification");

      consoleErrorSpy.mockRestore();
    });

    it("should default to first login when isFirstLogin not provided", async () => {
      // Arrange
      vi.mocked(systemMessageService.sendWelcomeNotification).mockResolvedValue(
        undefined
      );

      // Act
      await sendWelcomeMessage();

      // Assert
      expect(
        vi.mocked(systemMessageService.sendWelcomeNotification)
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe("hasWelcomeMessageBeenSent", () => {
    it("should return welcome message status from backend", async () => {
      // Arrange
      vi.mocked(
        systemMessageService.checkWelcomeMessageStatus
      ).mockResolvedValue(true);

      // Act
      const result = await hasWelcomeMessageBeenSent("test-user-id");

      // Assert
      expect(result).toBe(true);
      expect(
        vi.mocked(systemMessageService.checkWelcomeMessageStatus)
      ).toHaveBeenCalledTimes(1);
    });

    it("should return false when backend returns false", async () => {
      // Arrange
      vi.mocked(
        systemMessageService.checkWelcomeMessageStatus
      ).mockResolvedValue(false);

      // Act
      const result = await hasWelcomeMessageBeenSent("test-user-id");

      // Assert
      expect(result).toBe(false);
    });

    it("should handle API errors and return false", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(
        systemMessageService.checkWelcomeMessageStatus
      ).mockRejectedValue(new Error("API Error"));

      // Act
      const result = await hasWelcomeMessageBeenSent("test-user-id");

      // Assert
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      const firstCall = consoleErrorSpy.mock.calls[0];
      expect(firstCall[0]).toContain("Error checking welcome message status");

      consoleErrorSpy.mockRestore();
    });
  });
});
