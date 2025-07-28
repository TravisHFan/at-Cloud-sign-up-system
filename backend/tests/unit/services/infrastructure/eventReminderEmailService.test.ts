import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// Mock nodemailer since we're testing email generation, not sending
vi.mock("nodemailer", () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn(() => Promise.resolve({ messageId: "test-message-id" })),
  })),
}));

describe("EmailService - Event Reminder", () => {
  const mockEventData = {
    title: "Morning Prayer Service",
    date: "March 15, 2024",
    time: "8:00 AM",
    location: "Main Sanctuary",
    zoomLink: "https://zoom.us/j/123456789",
    format: "hybrid",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendEventReminderEmail", () => {
    it("should send email for in-person event successfully", async () => {
      const inPersonEventData = {
        ...mockEventData,
        format: "in-person",
      };

      const result = await EmailService.sendEventReminderEmail(
        "participant@test.com",
        "John Doe",
        inPersonEventData,
        "24h"
      );

      expect(result).toBe(true);
    });

    it("should send email for virtual event successfully", async () => {
      const virtualEventData = {
        ...mockEventData,
        format: "virtual",
        location: "", // Virtual events might not have location
      };

      const result = await EmailService.sendEventReminderEmail(
        "participant@test.com",
        "John Doe",
        virtualEventData,
        "24h"
      );

      expect(result).toBe(true);
    });

    it("should send email for hybrid event successfully", async () => {
      const result = await EmailService.sendEventReminderEmail(
        "participant@test.com",
        "John Doe",
        mockEventData,
        "24h"
      );

      expect(result).toBe(true);
    });

    it("should handle 1 hour reminder successfully", async () => {
      const result = await EmailService.sendEventReminderEmail(
        "participant@test.com",
        "John Doe",
        mockEventData,
        "1h"
      );

      expect(result).toBe(true);
    });

    it("should handle 24 hour reminder successfully", async () => {
      const result = await EmailService.sendEventReminderEmail(
        "participant@test.com",
        "John Doe",
        mockEventData,
        "24h"
      );

      expect(result).toBe(true);
    });

    it("should handle 1 week reminder successfully", async () => {
      const result = await EmailService.sendEventReminderEmail(
        "participant@test.com",
        "John Doe",
        mockEventData,
        "1week"
      );

      expect(result).toBe(true);
    });

    it("should handle missing optional fields gracefully", async () => {
      const minimalEventData = {
        title: "Test Event",
        date: "March 15, 2024",
        time: "8:00 AM",
        location: "",
        format: "in-person",
      };

      const result = await EmailService.sendEventReminderEmail(
        "participant@test.com",
        "John Doe",
        minimalEventData,
        "24h"
      );

      expect(result).toBe(true);
    });

    it("should handle invalid email gracefully", async () => {
      const result = await EmailService.sendEventReminderEmail(
        "invalid-email",
        "John Doe",
        mockEventData,
        "24h"
      );

      // The method should still return true as we're mocking nodemailer
      expect(result).toBe(true);
    });

    it("should work with all reminder types", async () => {
      const reminderTypes = ["1h", "24h", "1week"] as const;

      for (const reminderType of reminderTypes) {
        const result = await EmailService.sendEventReminderEmail(
          "participant@test.com",
          "John Doe",
          mockEventData,
          reminderType
        );

        expect(result).toBe(true);
      }
    });

    it("should work with all event formats", async () => {
      const formats = ["in-person", "virtual", "hybrid"];

      for (const format of formats) {
        const eventData = {
          ...mockEventData,
          format,
        };

        const result = await EmailService.sendEventReminderEmail(
          "participant@test.com",
          "John Doe",
          eventData,
          "24h"
        );

        expect(result).toBe(true);
      }
    });
  });
});
