import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailService } from "../../../src/services/infrastructure/EmailServiceFacade";

// Mock the ICS builder
vi.mock("../../../src/services/ICSBuilder", () => ({
  buildRegistrationICS: vi.fn(() => ({
    filename: "test-event.ics",
    content:
      "BEGIN:VCALENDAR\r\nPRODID:-//atCloud//Test//EN\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n",
  })),
}));

// Mock the sendEmail method to capture calls
const mockSendEmail = vi.fn();
vi.spyOn(EmailService, "sendEmail").mockImplementation(mockSendEmail);

describe("EmailService Role Assignment ICS Attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendEventRoleAssignedEmail", () => {
    it("should include ICS attachment with correct timezone handling", async () => {
      const mockData = {
        event: {
          _id: "test-event-id",
          title: "Test Event",
          date: "2024-06-15",
          endDate: "2024-06-15",
          time: "14:00",
          endTime: "15:00",
          location: "Conference Room",
          purpose: "Test purpose",
          timeZone: "America/Los_Angeles",
        },
        user: {
          firstName: "John",
          username: "john_doe",
        },
        roleName: "Presenter",
        actor: {
          firstName: "Jane",
          lastName: "Smith",
        },
        rejectionToken: "test-token-123",
      };

      await EmailService.sendEventRoleAssignedEmail(
        "john@example.com",
        mockData
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
          subject: "✅ Invited to Presenter - Test Event",
          attachments: [
            {
              filename: "test-event.ics",
              content: expect.stringContaining("BEGIN:VCALENDAR"),
              contentType: "text/calendar; charset=utf-8; method=PUBLISH",
            },
          ],
        })
      );
    });

    it("should handle ICS generation failure gracefully", async () => {
      // Mock ICS builder to throw error
      const { buildRegistrationICS } = await import(
        "../../../src/services/ICSBuilder"
      );
      vi.mocked(buildRegistrationICS).mockImplementationOnce(() => {
        throw new Error("ICS generation failed");
      });

      const mockData = {
        event: {
          _id: "test-event-id",
          title: "Test Event",
          date: "2024-06-15",
          time: "14:00",
          endTime: "15:00",
        },
        user: { firstName: "John" },
        roleName: "Presenter",
        actor: { firstName: "Jane", lastName: "Smith" },
      };

      await EmailService.sendEventRoleAssignedEmail(
        "john@example.com",
        mockData
      );

      // Should fallback to email without attachment
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
          subject: "✅ Invited to Presenter - Test Event",
        })
      );
      // Should not have attachments property when ICS fails
      expect(mockSendEmail.mock.calls[0][0]).not.toHaveProperty("attachments");
    });
  });

  describe("sendEventRoleMovedEmail", () => {
    it("should include ICS attachment for role moves", async () => {
      const mockData = {
        event: {
          _id: "test-event-id",
          title: "Test Event",
          date: "2024-06-15",
          time: "14:00",
          endTime: "15:00",
          timeZone: "America/New_York",
        },
        user: { firstName: "John" },
        fromRoleName: "Participant",
        toRoleName: "Presenter",
        actor: { firstName: "Jane", lastName: "Smith" },
      };

      await EmailService.sendEventRoleMovedEmail("john@example.com", mockData);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
          subject: "🔄 Role Updated: Presenter - Test Event",
          attachments: [
            {
              filename: "test-event.ics",
              content: expect.stringContaining("BEGIN:VCALENDAR"),
              contentType: "text/calendar; charset=utf-8; method=PUBLISH",
            },
          ],
        })
      );
    });
  });

  describe("sendEventRoleRemovedEmail", () => {
    it("should NOT include ICS attachment for role removals", async () => {
      const mockData = {
        event: { title: "Test Event" },
        user: { firstName: "John" },
        roleName: "Presenter",
        actor: { firstName: "Jane", lastName: "Smith" },
      };

      await EmailService.sendEventRoleRemovedEmail(
        "john@example.com",
        mockData
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
          subject: "⚠️ Removed from Presenter - Test Event",
        })
      );
      // Should not have attachments for removals
      expect(mockSendEmail.mock.calls[0][0]).not.toHaveProperty("attachments");
    });
  });
});
