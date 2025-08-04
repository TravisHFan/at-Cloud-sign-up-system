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

    it.skip("should handle API errors gracefully", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(systemMessageService.sendWelcomeNotification).mockRejectedValue(
        new Error("API Error")
      );

      // Act
      await sendWelcomeMessage(undefined, true);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to send welcome notification:",
        expect.any(Error)
      );

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

    it.skip("should handle API errors and return false", async () => {
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error checking welcome message status:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
