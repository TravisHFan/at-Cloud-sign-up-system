import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NotificationHelper } from "../../../../src/controllers/publicEvent/NotificationHelper";

// Mock dependencies
vi.mock("../../../../src/utils/privacy", () => ({
  hashEmail: vi.fn((email: string) => `hashed_${email}`),
}));

vi.mock("../../../../src/services/infrastructure/EmailServiceFacade", () => ({
  EmailService: {
    sendEmail: vi.fn(),
  },
}));

vi.mock("../../../../src/services/ICSBuilder", () => ({
  buildRegistrationICS: vi.fn().mockReturnValue({
    filename: "event.ics",
    content: "ICS_CONTENT",
  }),
}));

vi.mock(
  "../../../../src/services/emailTemplates/publicRegistrationConfirmation",
  () => ({
    default: vi.fn().mockReturnValue({
      subject: "Registration Confirmation",
      html: "<p>Confirmed</p>",
      text: "Confirmed",
    }),
  })
);

vi.mock("../../../../src/models/AuditLog", () => ({
  default: {
    create: vi.fn(),
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { buildRegistrationICS } from "../../../../src/services/ICSBuilder";
import buildPublicRegistrationConfirmationEmail from "../../../../src/services/emailTemplates/publicRegistrationConfirmation";
import AuditLog from "../../../../src/models/AuditLog";

describe("NotificationHelper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendConfirmationEmail", () => {
    const mockEvent = {
      _id: "event123",
      title: "Test Event",
      date: "2024-06-15",
      endDate: "2024-06-16",
      time: "10:00",
      endTime: "17:00",
      location: "Test Venue",
      purpose: "Team meeting",
      timeZone: "America/New_York",
      isHybrid: true,
      zoomLink: "https://zoom.us/test",
      meetingId: "123456",
      passcode: "abc123",
      format: "hybrid",
      roles: [
        { id: "role1", name: "Attendee", description: "General attendee" },
        { id: "role2", name: "Speaker", description: "Event speaker" },
      ],
    };

    it("should send confirmation email with ICS attachment", async () => {
      vi.mocked(EmailService.sendEmail).mockResolvedValue(true);

      await NotificationHelper.sendConfirmationEmail(
        mockEvent,
        "role1",
        { email: "attendee@test.com", name: "John Doe" },
        false
      );

      expect(buildRegistrationICS).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            title: "Test Event",
            date: "2024-06-15",
          }),
          role: expect.objectContaining({
            name: "Attendee",
          }),
          attendeeEmail: "attendee@test.com",
        })
      );
      expect(buildPublicRegistrationConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          roleName: "Attendee",
          duplicate: false,
        })
      );
      expect(EmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "attendee@test.com",
          subject: "Registration Confirmation",
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: "event.ics",
            }),
          ]),
        })
      );
    });

    it("should handle duplicate registration flag", async () => {
      vi.mocked(EmailService.sendEmail).mockResolvedValue(true);

      await NotificationHelper.sendConfirmationEmail(
        mockEvent,
        "role1",
        { email: "attendee@test.com" },
        true
      );

      expect(buildPublicRegistrationConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          duplicate: true,
        })
      );
    });

    it("should handle role not found gracefully", async () => {
      vi.mocked(EmailService.sendEmail).mockResolvedValue(true);

      await NotificationHelper.sendConfirmationEmail(
        mockEvent,
        "nonexistent-role",
        { email: "attendee@test.com" },
        false
      );

      expect(buildRegistrationICS).toHaveBeenCalledWith(
        expect.objectContaining({
          role: null,
        })
      );
      expect(buildPublicRegistrationConfirmationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          roleName: undefined,
        })
      );
    });

    it("should ignore email send failures silently", async () => {
      vi.mocked(EmailService.sendEmail).mockRejectedValue(
        new Error("Email failed")
      );

      // Should not throw
      await expect(
        NotificationHelper.sendConfirmationEmail(
          mockEvent,
          "role1",
          { email: "attendee@test.com" },
          false
        )
      ).resolves.not.toThrow();
    });

    it("should handle email build errors silently", async () => {
      vi.mocked(buildRegistrationICS).mockImplementationOnce(() => {
        throw new Error("ICS build failed");
      });

      // Should not throw
      await expect(
        NotificationHelper.sendConfirmationEmail(
          mockEvent,
          "role1",
          { email: "attendee@test.com" },
          false
        )
      ).resolves.not.toThrow();
    });
  });

  describe("createAuditLog", () => {
    const mockEvent = {
      _id: { toString: () => "event123" },
      title: "Test Event",
      date: "2024-06-15",
      time: "10:00",
      location: "Test Venue",
      roles: [],
    };

    const mockLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    it("should create audit log with event data", async () => {
      vi.mocked(AuditLog.create).mockResolvedValue({} as any);

      await NotificationHelper.createAuditLog(
        mockEvent as any,
        "role1",
        { email: "attendee@test.com" },
        "guest",
        false,
        10,
        9,
        "req-123",
        "192.168.1.0/24",
        mockLog as any
      );

      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "PublicRegistrationCreated",
          eventId: mockEvent._id,
          emailHash: "hashed_attendee@test.com",
          metadata: expect.objectContaining({
            eventId: "event123",
            roleId: "role1",
            registrationType: "guest",
            duplicate: false,
            capacityBefore: 10,
            capacityAfter: 9,
          }),
        })
      );
    });

    it("should include actor info when user is authenticated", async () => {
      vi.mocked(AuditLog.create).mockResolvedValue({} as any);
      const mockUser = {
        _id: "user123",
        role: "Admin",
        email: "admin@test.com",
      };

      await NotificationHelper.createAuditLog(
        mockEvent as any,
        "role1",
        { email: "attendee@test.com" },
        "user",
        false,
        10,
        9,
        "req-123",
        "192.168.1.0/24",
        mockLog as any,
        mockUser
      );

      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: {
            id: "user123",
            role: "Admin",
            email: "admin@test.com",
          },
        })
      );
    });

    it("should log info message after creating audit log", async () => {
      vi.mocked(AuditLog.create).mockResolvedValue({} as any);

      await NotificationHelper.createAuditLog(
        mockEvent as any,
        "role1",
        { email: "attendee@test.com" },
        "guest",
        false,
        10,
        9,
        "req-123",
        "192.168.1.0/24",
        mockLog as any
      );

      expect(mockLog.info).toHaveBeenCalledWith(
        "Public registration created",
        undefined,
        expect.objectContaining({
          eventId: "event123",
          roleId: "role1",
          registrationType: "guest",
        })
      );
    });

    it("should warn on audit log creation failure", async () => {
      vi.mocked(AuditLog.create).mockRejectedValue(new Error("DB error"));

      await NotificationHelper.createAuditLog(
        mockEvent as any,
        "role1",
        { email: "attendee@test.com" },
        "guest",
        false,
        10,
        9,
        "req-123",
        "192.168.1.0/24",
        mockLog as any
      );

      expect(mockLog.warn).toHaveBeenCalledWith(
        "Failed to persist audit log for public registration",
        undefined,
        { error: "DB error" }
      );
      // Should still log info message
      expect(mockLog.info).toHaveBeenCalled();
    });

    it("should handle duplicate flag correctly", async () => {
      vi.mocked(AuditLog.create).mockResolvedValue({} as any);

      await NotificationHelper.createAuditLog(
        mockEvent as any,
        "role1",
        { email: "attendee@test.com" },
        "guest",
        true,
        5,
        5,
        "req-456",
        "10.0.0.0/8",
        mockLog as any
      );

      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            duplicate: true,
          }),
        })
      );
    });
  });
});
