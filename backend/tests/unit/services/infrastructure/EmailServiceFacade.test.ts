/**
 * EmailServiceFacade - Comprehensive Delegation Tests
 *
 * This test file verifies that the EmailServiceFacade correctly delegates
 * to the underlying domain email services. Each facade method should pass
 * parameters through to the appropriate domain service.
 *
 * Testing Strategy:
 * - Mock all domain services
 * - Verify delegation happens with correct parameters
 * - Verify return values are passed through correctly
 * - Test both success and failure scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { AuthEmailService } from "../../../../src/services/email/domains/AuthEmailService";
import { EventEmailService } from "../../../../src/services/email/domains/EventEmailService";
import { RoleEmailService } from "../../../../src/services/email/domains/RoleEmailService";
import { GuestEmailService } from "../../../../src/services/email/domains/GuestEmailService";
import { UserEmailService } from "../../../../src/services/email/domains/UserEmailService";
import { PurchaseEmailService } from "../../../../src/services/email/domains/PurchaseEmailService";
import { UtilityEmailService } from "../../../../src/services/email/domains/UtilityEmailService";

// Mock all domain services
vi.mock("../../../../src/services/email/domains/AuthEmailService", () => ({
  AuthEmailService: {
    sendVerificationEmail: vi.fn().mockResolvedValue(true),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
    sendPasswordChangeRequestEmail: vi.fn().mockResolvedValue(true),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(true),
    sendWelcomeEmail: vi.fn().mockResolvedValue(true),
    sendAccountDeactivationEmail: vi.fn().mockResolvedValue(true),
    sendAccountReactivationEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../../src/services/email/domains/EventEmailService", () => ({
  EventEmailService: {
    sendEventNotificationEmail: vi.fn().mockResolvedValue(true),
    sendEventNotificationEmailBulk: vi.fn().mockResolvedValue([true, true]),
    sendEventAutoUnpublishNotification: vi.fn().mockResolvedValue(true),
    sendEventUnpublishWarningNotification: vi.fn().mockResolvedValue(true),
    sendEventActualUnpublishNotification: vi.fn().mockResolvedValue(true),
    sendEventCreatedEmail: vi.fn().mockResolvedValue(true),
    sendEventReminderEmail: vi.fn().mockResolvedValue(true),
    sendEventReminderEmailBulk: vi.fn().mockResolvedValue([true, true]),
    sendEventRoleAssignedEmail: vi.fn().mockResolvedValue(true),
    sendEventRoleRemovedEmail: vi.fn().mockResolvedValue(true),
    sendEventRoleMovedEmail: vi.fn().mockResolvedValue(true),
    sendEventRoleAssignmentRejectedEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../../src/services/email/domains/RoleEmailService", () => ({
  RoleEmailService: {
    sendPromotionNotificationToUser: vi.fn().mockResolvedValue(true),
    sendPromotionNotificationToAdmins: vi.fn().mockResolvedValue(true),
    sendDemotionNotificationToUser: vi.fn().mockResolvedValue(true),
    sendDemotionNotificationToAdmins: vi.fn().mockResolvedValue(true),
    sendAtCloudRoleChangeToUser: vi.fn().mockResolvedValue(true),
    sendAtCloudRoleChangeToAdmins: vi.fn().mockResolvedValue(true),
    sendNewLeaderSignupEmail: vi.fn().mockResolvedValue(true),
    sendCoOrganizerAssignedEmail: vi.fn().mockResolvedValue(true),
    sendAtCloudRoleAssignedToAdmins: vi.fn().mockResolvedValue(true),
    sendAtCloudRoleRemovedToAdmins: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../../src/services/email/domains/GuestEmailService", () => ({
  GuestEmailService: {
    sendGuestConfirmationEmail: vi.fn().mockResolvedValue(true),
    sendGuestDeclineNotification: vi.fn().mockResolvedValue(true),
    sendGuestRegistrationNotification: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../../src/services/email/domains/UserEmailService", () => ({
  UserEmailService: {
    sendUserDeactivatedAlertToAdmin: vi.fn().mockResolvedValue(true),
    sendUserReactivatedAlertToAdmin: vi.fn().mockResolvedValue(true),
    sendUserDeletedAlertToAdmin: vi.fn().mockResolvedValue(true),
    sendNewAtCloudLeaderSignupToAdmins: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../../src/services/email/domains/PurchaseEmailService", () => ({
  PurchaseEmailService: {
    sendPurchaseConfirmationEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../../src/services/email/domains/UtilityEmailService", () => ({
  UtilityEmailService: {
    sendGenericNotificationEmail: vi.fn().mockResolvedValue(true),
  },
}));

describe("EmailServiceFacade - Delegation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all mocks to their default return values after clearing
    vi.mocked(AuthEmailService.sendVerificationEmail).mockResolvedValue(true);
    vi.mocked(AuthEmailService.sendPasswordResetEmail).mockResolvedValue(true);
    vi.mocked(
      AuthEmailService.sendPasswordChangeRequestEmail,
    ).mockResolvedValue(true);
    vi.mocked(AuthEmailService.sendPasswordResetSuccessEmail).mockResolvedValue(
      true,
    );
    vi.mocked(AuthEmailService.sendWelcomeEmail).mockResolvedValue(true);
    vi.mocked(AuthEmailService.sendAccountDeactivationEmail).mockResolvedValue(
      true,
    );
    vi.mocked(AuthEmailService.sendAccountReactivationEmail).mockResolvedValue(
      true,
    );

    vi.mocked(EventEmailService.sendEventNotificationEmail).mockResolvedValue(
      true,
    );
    vi.mocked(
      EventEmailService.sendEventNotificationEmailBulk,
    ).mockResolvedValue([true, true]);
    vi.mocked(
      EventEmailService.sendEventAutoUnpublishNotification,
    ).mockResolvedValue(true);
    vi.mocked(
      EventEmailService.sendEventUnpublishWarningNotification,
    ).mockResolvedValue(true);
    vi.mocked(
      EventEmailService.sendEventActualUnpublishNotification,
    ).mockResolvedValue(true);
    vi.mocked(EventEmailService.sendEventCreatedEmail).mockResolvedValue(true);
    vi.mocked(EventEmailService.sendEventReminderEmail).mockResolvedValue(true);
    vi.mocked(EventEmailService.sendEventReminderEmailBulk).mockResolvedValue([
      true,
      true,
    ]);
    vi.mocked(EventEmailService.sendEventRoleAssignedEmail).mockResolvedValue(
      true,
    );
    vi.mocked(EventEmailService.sendEventRoleRemovedEmail).mockResolvedValue(
      true,
    );
    vi.mocked(EventEmailService.sendEventRoleMovedEmail).mockResolvedValue(
      true,
    );
    vi.mocked(
      EventEmailService.sendEventRoleAssignmentRejectedEmail,
    ).mockResolvedValue(true);

    vi.mocked(
      RoleEmailService.sendPromotionNotificationToUser,
    ).mockResolvedValue(true);
    vi.mocked(
      RoleEmailService.sendPromotionNotificationToAdmins,
    ).mockResolvedValue(true);
    vi.mocked(
      RoleEmailService.sendDemotionNotificationToUser,
    ).mockResolvedValue(true);
    vi.mocked(
      RoleEmailService.sendDemotionNotificationToAdmins,
    ).mockResolvedValue(true);
    vi.mocked(RoleEmailService.sendAtCloudRoleChangeToUser).mockResolvedValue(
      true,
    );
    vi.mocked(RoleEmailService.sendAtCloudRoleChangeToAdmins).mockResolvedValue(
      true,
    );
    vi.mocked(RoleEmailService.sendNewLeaderSignupEmail).mockResolvedValue(
      true,
    );
    vi.mocked(RoleEmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
      true,
    );
    vi.mocked(
      RoleEmailService.sendAtCloudRoleAssignedToAdmins,
    ).mockResolvedValue(true);
    vi.mocked(
      RoleEmailService.sendAtCloudRoleRemovedToAdmins,
    ).mockResolvedValue(true);

    vi.mocked(GuestEmailService.sendGuestConfirmationEmail).mockResolvedValue(
      true,
    );
    vi.mocked(GuestEmailService.sendGuestDeclineNotification).mockResolvedValue(
      true,
    );
    vi.mocked(
      GuestEmailService.sendGuestRegistrationNotification,
    ).mockResolvedValue(true);

    vi.mocked(
      UserEmailService.sendUserDeactivatedAlertToAdmin,
    ).mockResolvedValue(true);
    vi.mocked(
      UserEmailService.sendUserReactivatedAlertToAdmin,
    ).mockResolvedValue(true);
    vi.mocked(UserEmailService.sendUserDeletedAlertToAdmin).mockResolvedValue(
      true,
    );
    vi.mocked(
      UserEmailService.sendNewAtCloudLeaderSignupToAdmins,
    ).mockResolvedValue(true);

    vi.mocked(
      PurchaseEmailService.sendPurchaseConfirmationEmail,
    ).mockResolvedValue(true);

    vi.mocked(
      UtilityEmailService.sendGenericNotificationEmail,
    ).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===== Auth Email Service Delegations =====
  describe("Auth Email Methods", () => {
    describe("sendVerificationEmail", () => {
      it("should delegate to AuthEmailService.sendVerificationEmail", async () => {
        const result = await EmailService.sendVerificationEmail(
          "user@example.com",
          "John Doe",
          "verification-token-123",
        );

        expect(result).toBe(true);
        expect(AuthEmailService.sendVerificationEmail).toHaveBeenCalledWith(
          "user@example.com",
          "John Doe",
          "verification-token-123",
        );
        expect(AuthEmailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
      });

      it("should handle failure from AuthEmailService", async () => {
        vi.mocked(AuthEmailService.sendVerificationEmail).mockResolvedValueOnce(
          false,
        );

        const result = await EmailService.sendVerificationEmail(
          "fail@example.com",
          "Fail User",
          "bad-token",
        );

        expect(result).toBe(false);
      });
    });

    describe("sendPasswordResetEmail", () => {
      it("should delegate to AuthEmailService.sendPasswordResetEmail", async () => {
        const result = await EmailService.sendPasswordResetEmail(
          "user@example.com",
          "Jane Doe",
          "reset-token-456",
        );

        expect(result).toBe(true);
        expect(AuthEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
          "user@example.com",
          "Jane Doe",
          "reset-token-456",
        );
        expect(AuthEmailService.sendPasswordResetEmail).toHaveBeenCalledTimes(
          1,
        );
      });

      it("should handle failure from AuthEmailService", async () => {
        vi.mocked(
          AuthEmailService.sendPasswordResetEmail,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendPasswordResetEmail(
          "fail@example.com",
          "Fail User",
          "bad-token",
        );

        expect(result).toBe(false);
      });
    });

    describe("sendPasswordChangeRequestEmail", () => {
      it("should delegate to AuthEmailService.sendPasswordChangeRequestEmail", async () => {
        const result = await EmailService.sendPasswordChangeRequestEmail(
          "user@example.com",
          "Bob Smith",
          "confirm-token-789",
        );

        expect(result).toBe(true);
        expect(
          AuthEmailService.sendPasswordChangeRequestEmail,
        ).toHaveBeenCalledWith(
          "user@example.com",
          "Bob Smith",
          "confirm-token-789",
        );
      });

      it("should handle failure from AuthEmailService", async () => {
        vi.mocked(
          AuthEmailService.sendPasswordChangeRequestEmail,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendPasswordChangeRequestEmail(
          "fail@example.com",
          "Fail User",
          "bad-token",
        );

        expect(result).toBe(false);
      });
    });

    describe("sendPasswordResetSuccessEmail", () => {
      it("should delegate to AuthEmailService.sendPasswordResetSuccessEmail", async () => {
        const result = await EmailService.sendPasswordResetSuccessEmail(
          "user@example.com",
          "Alice Johnson",
        );

        expect(result).toBe(true);
        expect(
          AuthEmailService.sendPasswordResetSuccessEmail,
        ).toHaveBeenCalledWith("user@example.com", "Alice Johnson");
      });

      it("should handle failure from AuthEmailService", async () => {
        vi.mocked(
          AuthEmailService.sendPasswordResetSuccessEmail,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendPasswordResetSuccessEmail(
          "fail@example.com",
          "Fail User",
        );

        expect(result).toBe(false);
      });
    });

    describe("sendWelcomeEmail", () => {
      it("should delegate to AuthEmailService.sendWelcomeEmail", async () => {
        const result = await EmailService.sendWelcomeEmail(
          "newuser@example.com",
          "New User",
        );

        expect(result).toBe(true);
        expect(AuthEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
          "newuser@example.com",
          "New User",
        );
      });

      it("should handle failure from AuthEmailService", async () => {
        vi.mocked(AuthEmailService.sendWelcomeEmail).mockResolvedValueOnce(
          false,
        );

        const result = await EmailService.sendWelcomeEmail(
          "fail@example.com",
          "Fail User",
        );

        expect(result).toBe(false);
      });
    });

    describe("sendAccountDeactivationEmail", () => {
      it("should delegate to AuthEmailService.sendAccountDeactivationEmail", async () => {
        const deactivatedBy = {
          role: "Administrator",
          firstName: "Admin",
          lastName: "User",
        };

        const result = await EmailService.sendAccountDeactivationEmail(
          "user@example.com",
          "Deactivated User",
          deactivatedBy,
        );

        expect(result).toBe(true);
        expect(
          AuthEmailService.sendAccountDeactivationEmail,
        ).toHaveBeenCalledWith(
          "user@example.com",
          "Deactivated User",
          deactivatedBy,
        );
      });

      it("should handle failure from AuthEmailService", async () => {
        vi.mocked(
          AuthEmailService.sendAccountDeactivationEmail,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendAccountDeactivationEmail(
          "fail@example.com",
          "Fail User",
          { role: "Admin" },
        );

        expect(result).toBe(false);
      });
    });

    describe("sendAccountReactivationEmail", () => {
      it("should delegate to AuthEmailService.sendAccountReactivationEmail", async () => {
        const reactivatedBy = {
          role: "Super Admin",
          firstName: "Super",
          lastName: "Admin",
        };

        const result = await EmailService.sendAccountReactivationEmail(
          "user@example.com",
          "Reactivated User",
          reactivatedBy,
        );

        expect(result).toBe(true);
        expect(
          AuthEmailService.sendAccountReactivationEmail,
        ).toHaveBeenCalledWith(
          "user@example.com",
          "Reactivated User",
          reactivatedBy,
        );
      });

      it("should handle failure from AuthEmailService", async () => {
        vi.mocked(
          AuthEmailService.sendAccountReactivationEmail,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendAccountReactivationEmail(
          "fail@example.com",
          "Fail User",
          { role: "Admin" },
        );

        expect(result).toBe(false);
      });
    });
  });

  // ===== Guest Email Service Delegations =====
  describe("Guest Email Methods", () => {
    describe("sendGuestConfirmationEmail", () => {
      it("should delegate to GuestEmailService.sendGuestConfirmationEmail", async () => {
        const params = {
          guestEmail: "guest@example.com",
          guestName: "Guest User",
          event: {
            title: "Test Event",
            date: new Date("2025-03-01"),
            location: "Test Location",
            time: "10:00",
            endTime: "12:00",
          },
          role: { name: "Attendee", description: "Event attendee" },
          registrationId: "reg-123",
          manageToken: "manage-token-456",
        };

        const result = await EmailService.sendGuestConfirmationEmail(params);

        expect(result).toBe(true);
        expect(
          GuestEmailService.sendGuestConfirmationEmail,
        ).toHaveBeenCalledWith(params);
      });

      it("should handle minimal params", async () => {
        const params = {
          guestEmail: "guest@example.com",
          guestName: "Guest User",
          event: { title: "Test Event", date: "2025-03-01" },
          role: { name: "Attendee" },
          registrationId: "reg-123",
        };

        const result = await EmailService.sendGuestConfirmationEmail(params);

        expect(result).toBe(true);
        expect(
          GuestEmailService.sendGuestConfirmationEmail,
        ).toHaveBeenCalledWith(params);
      });

      it("should handle failure from GuestEmailService", async () => {
        vi.mocked(
          GuestEmailService.sendGuestConfirmationEmail,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendGuestConfirmationEmail({
          guestEmail: "fail@example.com",
          guestName: "Fail",
          event: { title: "Test", date: "2025-01-01" },
          role: { name: "Test" },
          registrationId: "fail",
        });

        expect(result).toBe(false);
      });
    });

    describe("sendGuestDeclineNotification", () => {
      it("should delegate to GuestEmailService.sendGuestDeclineNotification", async () => {
        const params = {
          event: { title: "Test Event", date: new Date("2025-03-01") },
          roleName: "Speaker",
          guest: { name: "Guest User", email: "guest@example.com" },
          reason: "Schedule conflict",
          organizerEmails: ["organizer1@example.com", "organizer2@example.com"],
        };

        const result = await EmailService.sendGuestDeclineNotification(params);

        expect(result).toBe(true);
        expect(
          GuestEmailService.sendGuestDeclineNotification,
        ).toHaveBeenCalledWith(params);
      });

      it("should handle decline without reason", async () => {
        const params = {
          event: { title: "Test Event", date: "2025-03-01" },
          guest: { name: "Guest User", email: "guest@example.com" },
          organizerEmails: ["organizer@example.com"],
        };

        const result = await EmailService.sendGuestDeclineNotification(params);

        expect(result).toBe(true);
        expect(
          GuestEmailService.sendGuestDeclineNotification,
        ).toHaveBeenCalledWith(params);
      });

      it("should handle failure from GuestEmailService", async () => {
        vi.mocked(
          GuestEmailService.sendGuestDeclineNotification,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendGuestDeclineNotification({
          event: { title: "Test", date: "2025-01-01" },
          guest: { name: "Fail", email: "fail@example.com" },
          organizerEmails: [],
        });

        expect(result).toBe(false);
      });
    });

    describe("sendGuestRegistrationNotification", () => {
      it("should delegate to GuestEmailService.sendGuestRegistrationNotification", async () => {
        const params = {
          organizerEmails: ["organizer@example.com"],
          event: {
            title: "Test Event",
            date: new Date("2025-03-01"),
            location: "Test Location",
            time: "10:00",
            endTime: "12:00",
            timeZone: "America/New_York",
          },
          guest: {
            name: "New Guest",
            email: "newguest@example.com",
            phone: "555-1234",
          },
          role: { name: "Volunteer" },
          registrationDate: new Date(),
        };

        const result =
          await EmailService.sendGuestRegistrationNotification(params);

        expect(result).toBe(true);
        expect(
          GuestEmailService.sendGuestRegistrationNotification,
        ).toHaveBeenCalledWith(params);
      });

      it("should handle failure from GuestEmailService", async () => {
        vi.mocked(
          GuestEmailService.sendGuestRegistrationNotification,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendGuestRegistrationNotification({
          organizerEmails: [],
          event: { title: "Test", date: "2025-01-01" },
          guest: { name: "Fail", email: "fail@example.com" },
          role: { name: "Test" },
          registrationDate: new Date(),
        });

        expect(result).toBe(false);
      });
    });
  });

  // ===== User Email Service Delegations =====
  describe("User Email Methods", () => {
    const adminEmail = "admin@example.com";
    const adminName = "Admin User";
    const target = {
      firstName: "Target",
      lastName: "User",
      email: "target@example.com",
    };
    const actor = {
      firstName: "Actor",
      lastName: "Admin",
      email: "actor@example.com",
      role: "Administrator",
    };

    describe("sendUserDeactivatedAlertToAdmin", () => {
      it("should delegate to UserEmailService.sendUserDeactivatedAlertToAdmin", async () => {
        const result = await EmailService.sendUserDeactivatedAlertToAdmin(
          adminEmail,
          adminName,
          target,
          actor,
        );

        expect(result).toBe(true);
        expect(
          UserEmailService.sendUserDeactivatedAlertToAdmin,
        ).toHaveBeenCalledWith(adminEmail, adminName, target, actor);
      });

      it("should handle failure from UserEmailService", async () => {
        vi.mocked(
          UserEmailService.sendUserDeactivatedAlertToAdmin,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendUserDeactivatedAlertToAdmin(
          "fail@example.com",
          "Fail",
          target,
          actor,
        );

        expect(result).toBe(false);
      });
    });

    describe("sendUserReactivatedAlertToAdmin", () => {
      it("should delegate to UserEmailService.sendUserReactivatedAlertToAdmin", async () => {
        const result = await EmailService.sendUserReactivatedAlertToAdmin(
          adminEmail,
          adminName,
          target,
          actor,
        );

        expect(result).toBe(true);
        expect(
          UserEmailService.sendUserReactivatedAlertToAdmin,
        ).toHaveBeenCalledWith(adminEmail, adminName, target, actor);
      });

      it("should handle failure from UserEmailService", async () => {
        vi.mocked(
          UserEmailService.sendUserReactivatedAlertToAdmin,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendUserReactivatedAlertToAdmin(
          "fail@example.com",
          "Fail",
          target,
          actor,
        );

        expect(result).toBe(false);
      });
    });

    describe("sendUserDeletedAlertToAdmin", () => {
      it("should delegate to UserEmailService.sendUserDeletedAlertToAdmin", async () => {
        const result = await EmailService.sendUserDeletedAlertToAdmin(
          adminEmail,
          adminName,
          target,
          actor,
        );

        expect(result).toBe(true);
        expect(
          UserEmailService.sendUserDeletedAlertToAdmin,
        ).toHaveBeenCalledWith(adminEmail, adminName, target, actor);
      });

      it("should handle failure from UserEmailService", async () => {
        vi.mocked(
          UserEmailService.sendUserDeletedAlertToAdmin,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendUserDeletedAlertToAdmin(
          "fail@example.com",
          "Fail",
          target,
          actor,
        );

        expect(result).toBe(false);
      });
    });

    describe("sendNewAtCloudLeaderSignupToAdmins", () => {
      it("should delegate to UserEmailService.sendNewAtCloudLeaderSignupToAdmins", async () => {
        const userData = {
          firstName: "New",
          lastName: "Leader",
          email: "leader@example.com",
          roleInAtCloud: "Team Lead",
        };

        const result = await EmailService.sendNewAtCloudLeaderSignupToAdmins(
          adminEmail,
          adminName,
          userData,
        );

        expect(result).toBe(true);
        expect(
          UserEmailService.sendNewAtCloudLeaderSignupToAdmins,
        ).toHaveBeenCalledWith(adminEmail, adminName, userData);
      });

      it("should handle failure from UserEmailService", async () => {
        vi.mocked(
          UserEmailService.sendNewAtCloudLeaderSignupToAdmins,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendNewAtCloudLeaderSignupToAdmins(
          "fail@example.com",
          "Fail",
          {
            firstName: "F",
            lastName: "L",
            email: "f@x.com",
            roleInAtCloud: "Test",
          },
        );

        expect(result).toBe(false);
      });
    });
  });

  // ===== Event Email Service Delegations =====
  describe("Event Email Methods", () => {
    describe("sendEventNotificationEmail", () => {
      it("should delegate to EventEmailService.sendEventNotificationEmail", async () => {
        const data = {
          eventTitle: "Test Event",
          eventDate: "2025-03-01",
          message: "Test message",
        };

        const result = await EmailService.sendEventNotificationEmail(
          "user@example.com",
          "User Name",
          data,
        );

        expect(result).toBe(true);
        expect(
          EventEmailService.sendEventNotificationEmail,
        ).toHaveBeenCalledWith("user@example.com", "User Name", data);
      });

      it("should handle failure from EventEmailService", async () => {
        vi.mocked(
          EventEmailService.sendEventNotificationEmail,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendEventNotificationEmail(
          "fail@example.com",
          "Fail",
          {},
        );

        expect(result).toBe(false);
      });
    });

    describe("sendEventNotificationEmailBulk", () => {
      it("should delegate to EventEmailService.sendEventNotificationEmailBulk", async () => {
        const recipients = [
          { email: "user1@example.com", name: "User 1" },
          { email: "user2@example.com", name: "User 2" },
        ];
        const payload = {
          eventTitle: "Bulk Event",
          date: "2025-03-01",
          message: "Bulk notification",
        };

        const result = await EmailService.sendEventNotificationEmailBulk(
          recipients,
          payload,
        );

        expect(result).toEqual([true, true]);
        expect(
          EventEmailService.sendEventNotificationEmailBulk,
        ).toHaveBeenCalledWith(recipients, payload);
      });
    });

    describe("sendEventAutoUnpublishNotification", () => {
      it("should delegate to EventEmailService.sendEventAutoUnpublishNotification", async () => {
        const params = {
          eventId: "event-123",
          title: "Test Event",
          format: "Online",
          missingFields: ["description", "time"],
          recipients: ["organizer@example.com"],
        };

        const result =
          await EmailService.sendEventAutoUnpublishNotification(params);

        expect(result).toBe(true);
        expect(
          EventEmailService.sendEventAutoUnpublishNotification,
        ).toHaveBeenCalledWith(params);
      });
    });

    describe("sendEventUnpublishWarningNotification", () => {
      it("should delegate to EventEmailService.sendEventUnpublishWarningNotification", async () => {
        const params = {
          eventId: "event-456",
          title: "Warning Event",
          missingFields: ["location"],
        };

        const result =
          await EmailService.sendEventUnpublishWarningNotification(params);

        expect(result).toBe(true);
        expect(
          EventEmailService.sendEventUnpublishWarningNotification,
        ).toHaveBeenCalledWith(params);
      });
    });

    describe("sendEventActualUnpublishNotification", () => {
      it("should delegate to EventEmailService.sendEventActualUnpublishNotification", async () => {
        const params = {
          eventId: "event-789",
          title: "Unpublished Event",
          format: "Hybrid",
        };

        const result =
          await EmailService.sendEventActualUnpublishNotification(params);

        expect(result).toBe(true);
        expect(
          EventEmailService.sendEventActualUnpublishNotification,
        ).toHaveBeenCalledWith(params);
      });
    });

    describe("sendEventCreatedEmail", () => {
      it("should delegate to EventEmailService.sendEventCreatedEmail", async () => {
        const eventData = {
          title: "New Event",
          date: "2025-04-01",
          time: "14:00",
          endTime: "16:00",
          location: "Main Hall",
          organizer: "John Organizer",
          format: "In-person",
        };

        const result = await EmailService.sendEventCreatedEmail(
          "user@example.com",
          "User Name",
          eventData,
        );

        expect(result).toBe(true);
        expect(EventEmailService.sendEventCreatedEmail).toHaveBeenCalledWith(
          "user@example.com",
          "User Name",
          eventData,
        );
      });

      it("should handle recurring event info", async () => {
        const eventData = {
          title: "Recurring Event",
          date: "2025-04-01",
          time: "14:00",
          endTime: "16:00",
          organizer: "John Organizer",
          format: "Online",
          zoomLink: "https://zoom.us/j/123456",
          recurringInfo: {
            frequency: "monthly" as const,
            occurrenceCount: 6,
          },
        };

        const result = await EmailService.sendEventCreatedEmail(
          "user@example.com",
          "User Name",
          eventData,
        );

        expect(result).toBe(true);
        expect(EventEmailService.sendEventCreatedEmail).toHaveBeenCalledWith(
          "user@example.com",
          "User Name",
          eventData,
        );
      });
    });

    describe("sendEventReminderEmail", () => {
      it("should delegate to EventEmailService.sendEventReminderEmail", async () => {
        const eventData = {
          title: "Reminder Event",
          date: "2025-03-15",
          time: "10:00",
          location: "Room A",
          format: "In-person",
        };

        const result = await EmailService.sendEventReminderEmail(
          "user@example.com",
          "User Name",
          eventData,
          "24h",
        );

        expect(result).toBe(true);
        expect(EventEmailService.sendEventReminderEmail).toHaveBeenCalledWith(
          "user@example.com",
          "User Name",
          eventData,
          "24h",
        );
      });

      it("should handle different reminder types", async () => {
        const eventData = {
          title: "Test Event",
          date: "2025-03-15",
          time: "10:00",
          location: "Room B",
          format: "Online",
          zoomLink: "https://zoom.us/test",
        };

        for (const reminderType of ["1h", "24h", "1week"] as const) {
          vi.mocked(
            EventEmailService.sendEventReminderEmail,
          ).mockResolvedValueOnce(true);

          await EmailService.sendEventReminderEmail(
            "user@example.com",
            "User",
            eventData,
            reminderType,
          );

          expect(EventEmailService.sendEventReminderEmail).toHaveBeenCalledWith(
            "user@example.com",
            "User",
            eventData,
            reminderType,
          );
        }
      });
    });

    describe("sendEventReminderEmailBulk", () => {
      it("should delegate to EventEmailService.sendEventReminderEmailBulk", async () => {
        const recipients = [
          { email: "user1@example.com", name: "User 1" },
          { email: "user2@example.com", name: "User 2" },
        ];
        const eventData = {
          title: "Bulk Reminder Event",
          date: "2025-03-15",
          time: "10:00",
          location: "Main Hall",
          format: "In-person",
        };

        const result = await EmailService.sendEventReminderEmailBulk(
          recipients,
          eventData,
          "1week",
        );

        expect(result).toEqual([true, true]);
        expect(
          EventEmailService.sendEventReminderEmailBulk,
        ).toHaveBeenCalledWith(recipients, eventData, "1week");
      });
    });

    describe("sendEventRoleAssignedEmail", () => {
      it("should delegate to EventEmailService.sendEventRoleAssignedEmail", async () => {
        const data = {
          event: { id: "event-123", title: "Test Event" },
          user: { firstName: "John", lastName: "Doe" },
          roleName: "Speaker",
          actor: { firstName: "Admin", lastName: "User" },
          rejectionToken: "reject-token-456",
        };

        const result = await EmailService.sendEventRoleAssignedEmail(
          "user@example.com",
          data,
        );

        expect(result).toBe(true);
        expect(
          EventEmailService.sendEventRoleAssignedEmail,
        ).toHaveBeenCalledWith("user@example.com", data);
      });
    });

    describe("sendEventRoleRemovedEmail", () => {
      it("should delegate to EventEmailService.sendEventRoleRemovedEmail", async () => {
        const data = {
          event: { id: "event-123", title: "Test Event" },
          user: { firstName: "John", lastName: "Doe" },
          roleName: "Speaker",
          actor: { firstName: "Admin", lastName: "User" },
        };

        const result = await EmailService.sendEventRoleRemovedEmail(
          "user@example.com",
          data,
        );

        expect(result).toBe(true);
        expect(
          EventEmailService.sendEventRoleRemovedEmail,
        ).toHaveBeenCalledWith("user@example.com", data);
      });
    });

    describe("sendEventRoleMovedEmail", () => {
      it("should delegate to EventEmailService.sendEventRoleMovedEmail", async () => {
        const data = {
          event: { id: "event-123", title: "Test Event" },
          user: { firstName: "John", lastName: "Doe" },
          fromRoleName: "Volunteer",
          toRoleName: "Speaker",
          actor: { firstName: "Admin", lastName: "User" },
        };

        const result = await EmailService.sendEventRoleMovedEmail(
          "user@example.com",
          data,
        );

        expect(result).toBe(true);
        expect(EventEmailService.sendEventRoleMovedEmail).toHaveBeenCalledWith(
          "user@example.com",
          data,
        );
      });
    });

    describe("sendEventRoleAssignmentRejectedEmail", () => {
      it("should delegate to EventEmailService.sendEventRoleAssignmentRejectedEmail", async () => {
        const data = {
          event: { id: "event-123", title: "Test Event" },
          roleName: "Speaker",
          rejectedBy: { firstName: "John", lastName: "Doe" },
          assigner: { firstName: "Admin", lastName: "User" },
          noteProvided: true,
          noteText: "Schedule conflict with another commitment",
        };

        const result = await EmailService.sendEventRoleAssignmentRejectedEmail(
          "organizer@example.com",
          data,
        );

        expect(result).toBe(true);
        expect(
          EventEmailService.sendEventRoleAssignmentRejectedEmail,
        ).toHaveBeenCalledWith("organizer@example.com", data);
      });

      it("should handle rejection without note", async () => {
        const data = {
          event: { id: "event-123", title: "Test Event" },
          roleName: "Volunteer",
          rejectedBy: { firstName: "Jane" },
          assigner: { lastName: "Admin" },
          noteProvided: false,
        };

        const result = await EmailService.sendEventRoleAssignmentRejectedEmail(
          "organizer@example.com",
          data,
        );

        expect(result).toBe(true);
        expect(
          EventEmailService.sendEventRoleAssignmentRejectedEmail,
        ).toHaveBeenCalledWith("organizer@example.com", data);
      });
    });
  });

  // ===== Role Email Service Delegations =====
  describe("Role Email Methods", () => {
    describe("sendPromotionNotificationToUser", () => {
      it("should delegate to RoleEmailService.sendPromotionNotificationToUser", async () => {
        const userData = {
          firstName: "John",
          lastName: "Doe",
          oldRole: "Leader",
          newRole: "Administrator",
        };
        const changedBy = {
          firstName: "Super",
          lastName: "Admin",
          role: "Super Admin",
        };

        const result = await EmailService.sendPromotionNotificationToUser(
          "user@example.com",
          userData,
          changedBy,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendPromotionNotificationToUser,
        ).toHaveBeenCalledWith("user@example.com", userData, changedBy);
      });
    });

    describe("sendPromotionNotificationToAdmins", () => {
      it("should delegate to RoleEmailService.sendPromotionNotificationToAdmins", async () => {
        const userData = {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          oldRole: "Leader",
          newRole: "Administrator",
        };
        const changedBy = {
          firstName: "Super",
          lastName: "Admin",
          role: "Super Admin",
        };

        const result = await EmailService.sendPromotionNotificationToAdmins(
          "admin@example.com",
          "Admin Name",
          userData,
          changedBy,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendPromotionNotificationToAdmins,
        ).toHaveBeenCalledWith(
          "admin@example.com",
          "Admin Name",
          userData,
          changedBy,
        );
      });
    });

    describe("sendDemotionNotificationToUser", () => {
      it("should delegate to RoleEmailService.sendDemotionNotificationToUser", async () => {
        const userData = {
          _id: "user-123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          oldRole: "Administrator",
          newRole: "Leader",
        };
        const changedBy = {
          firstName: "Super",
          lastName: "Admin",
          email: "super@example.com",
          role: "Super Admin",
        };
        const reason = "Organizational restructuring";

        const result = await EmailService.sendDemotionNotificationToUser(
          "user@example.com",
          userData,
          changedBy,
          reason,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendDemotionNotificationToUser,
        ).toHaveBeenCalledWith("user@example.com", userData, changedBy, reason);
      });

      it("should handle demotion without reason", async () => {
        const userData = {
          _id: "user-456",
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com",
          oldRole: "Administrator",
          newRole: "User",
        };
        const changedBy = {
          firstName: "Admin",
          lastName: "User",
          email: "admin@example.com",
          role: "Super Admin",
        };

        const result = await EmailService.sendDemotionNotificationToUser(
          "user@example.com",
          userData,
          changedBy,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendDemotionNotificationToUser,
        ).toHaveBeenCalledWith(
          "user@example.com",
          userData,
          changedBy,
          undefined,
        );
      });
    });

    describe("sendDemotionNotificationToAdmins", () => {
      it("should delegate to RoleEmailService.sendDemotionNotificationToAdmins", async () => {
        const userData = {
          _id: "user-123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          oldRole: "Administrator",
          newRole: "Leader",
        };
        const changedBy = {
          firstName: "Super",
          lastName: "Admin",
          email: "super@example.com",
          role: "Super Admin",
        };
        const reason = "Performance review";

        const result = await EmailService.sendDemotionNotificationToAdmins(
          "admin@example.com",
          "Admin Name",
          userData,
          changedBy,
          reason,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendDemotionNotificationToAdmins,
        ).toHaveBeenCalledWith(
          "admin@example.com",
          "Admin Name",
          userData,
          changedBy,
          reason,
        );
      });
    });

    describe("sendAtCloudRoleChangeToUser", () => {
      it("should delegate to RoleEmailService.sendAtCloudRoleChangeToUser", async () => {
        const userData = {
          _id: "user-123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          oldRoleInAtCloud: "Team Member",
          newRoleInAtCloud: "Team Lead",
        };

        const result = await EmailService.sendAtCloudRoleChangeToUser(
          "user@example.com",
          userData,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendAtCloudRoleChangeToUser,
        ).toHaveBeenCalledWith("user@example.com", userData);
      });
    });

    describe("sendAtCloudRoleChangeToAdmins", () => {
      it("should delegate to RoleEmailService.sendAtCloudRoleChangeToAdmins", async () => {
        const userData = {
          _id: "user-123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          oldRoleInAtCloud: "Team Member",
          newRoleInAtCloud: "Team Lead",
        };

        const result = await EmailService.sendAtCloudRoleChangeToAdmins(
          "admin@example.com",
          "Admin Name",
          userData,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendAtCloudRoleChangeToAdmins,
        ).toHaveBeenCalledWith("admin@example.com", "Admin Name", userData);
      });
    });

    describe("sendNewLeaderSignupEmail", () => {
      it("should delegate to RoleEmailService.sendNewLeaderSignupEmail", async () => {
        const newLeaderData = {
          firstName: "New",
          lastName: "Leader",
          email: "newleader@example.com",
          roleInAtCloud: "Team Lead",
          signupDate: "2025-02-01",
        };

        const result = await EmailService.sendNewLeaderSignupEmail(
          "admin@example.com",
          "Admin Name",
          newLeaderData,
        );

        expect(result).toBe(true);
        expect(RoleEmailService.sendNewLeaderSignupEmail).toHaveBeenCalledWith(
          "admin@example.com",
          "Admin Name",
          newLeaderData,
        );
      });
    });

    describe("sendCoOrganizerAssignedEmail", () => {
      it("should delegate to RoleEmailService.sendCoOrganizerAssignedEmail", async () => {
        const assignedUser = { firstName: "Co", lastName: "Organizer" };
        const eventData = {
          title: "Team Event",
          date: "2025-03-01",
          time: "10:00",
          location: "Conference Room A",
        };
        const assignedBy = { firstName: "Main", lastName: "Organizer" };

        const result = await EmailService.sendCoOrganizerAssignedEmail(
          "coorganizer@example.com",
          assignedUser,
          eventData,
          assignedBy,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendCoOrganizerAssignedEmail,
        ).toHaveBeenCalledWith(
          "coorganizer@example.com",
          assignedUser,
          eventData,
          assignedBy,
        );
      });

      it("should handle event with end time and date", async () => {
        const assignedUser = { firstName: "Co", lastName: "Organizer" };
        const eventData = {
          title: "Multi-day Event",
          date: "2025-03-01",
          time: "10:00",
          endTime: "18:00",
          endDate: "2025-03-03",
          location: "Main Hall",
        };
        const assignedBy = { firstName: "Event", lastName: "Creator" };

        const result = await EmailService.sendCoOrganizerAssignedEmail(
          "coorganizer@example.com",
          assignedUser,
          eventData,
          assignedBy,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendCoOrganizerAssignedEmail,
        ).toHaveBeenCalledWith(
          "coorganizer@example.com",
          assignedUser,
          eventData,
          assignedBy,
        );
      });
    });

    describe("sendAtCloudRoleAssignedToAdmins", () => {
      it("should delegate to RoleEmailService.sendAtCloudRoleAssignedToAdmins", async () => {
        const userData = {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          roleInAtCloud: "Team Lead",
        };

        const result = await EmailService.sendAtCloudRoleAssignedToAdmins(
          "admin@example.com",
          "Admin Name",
          userData,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendAtCloudRoleAssignedToAdmins,
        ).toHaveBeenCalledWith("admin@example.com", "Admin Name", userData);
      });
    });

    describe("sendAtCloudRoleRemovedToAdmins", () => {
      it("should delegate to RoleEmailService.sendAtCloudRoleRemovedToAdmins", async () => {
        const userData = {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          previousRoleInAtCloud: "Team Lead",
        };

        const result = await EmailService.sendAtCloudRoleRemovedToAdmins(
          "admin@example.com",
          "Admin Name",
          userData,
        );

        expect(result).toBe(true);
        expect(
          RoleEmailService.sendAtCloudRoleRemovedToAdmins,
        ).toHaveBeenCalledWith("admin@example.com", "Admin Name", userData);
      });
    });
  });

  // ===== Purchase Email Service Delegations =====
  describe("Purchase Email Methods", () => {
    describe("sendPurchaseConfirmationEmail", () => {
      it("should delegate to PurchaseEmailService.sendPurchaseConfirmationEmail", async () => {
        const params = {
          email: "buyer@example.com",
          name: "Buyer Name",
          orderNumber: "ORD-12345",
          programTitle: "Leadership Workshop",
          programType: "Workshop",
          purchaseDate: new Date("2025-02-01"),
          fullPrice: 100,
          finalPrice: 80,
          classRepDiscount: 10,
          earlyBirdDiscount: 10,
          isClassRep: true,
          isEarlyBird: true,
          receiptUrl: "https://example.com/receipts/12345",
        };

        const result = await EmailService.sendPurchaseConfirmationEmail(params);

        expect(result).toBe(true);
        expect(
          PurchaseEmailService.sendPurchaseConfirmationEmail,
        ).toHaveBeenCalledWith(params);
      });

      it("should handle purchase without discounts", async () => {
        const params = {
          email: "buyer@example.com",
          name: "Buyer Name",
          orderNumber: "ORD-12346",
          programTitle: "Basic Training",
          programType: "Course",
          purchaseDate: new Date("2025-02-01"),
          fullPrice: 50,
          finalPrice: 50,
          isClassRep: false,
          isEarlyBird: false,
          receiptUrl: "https://example.com/receipts/12346",
        };

        const result = await EmailService.sendPurchaseConfirmationEmail(params);

        expect(result).toBe(true);
        expect(
          PurchaseEmailService.sendPurchaseConfirmationEmail,
        ).toHaveBeenCalledWith(params);
      });

      it("should handle failure from PurchaseEmailService", async () => {
        vi.mocked(
          PurchaseEmailService.sendPurchaseConfirmationEmail,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendPurchaseConfirmationEmail({
          email: "fail@example.com",
          name: "Fail",
          orderNumber: "FAIL",
          programTitle: "Test",
          programType: "Test",
          purchaseDate: new Date(),
          fullPrice: 0,
          finalPrice: 0,
          isClassRep: false,
          isEarlyBird: false,
          receiptUrl: "https://example.com/fail",
        });

        expect(result).toBe(false);
      });
    });
  });

  // ===== Utility Email Service Delegations =====
  describe("Utility Email Methods", () => {
    describe("sendGenericNotificationEmail", () => {
      it("should delegate to UtilityEmailService.sendGenericNotificationEmail", async () => {
        const payload = {
          subject: "Generic Notification",
          contentHtml: "<p>This is a generic notification</p>",
          contentText: "This is a generic notification",
        };

        const result = await EmailService.sendGenericNotificationEmail(
          "user@example.com",
          "User Name",
          payload,
        );

        expect(result).toBe(true);
        expect(
          UtilityEmailService.sendGenericNotificationEmail,
        ).toHaveBeenCalledWith("user@example.com", "User Name", payload);
      });

      it("should handle HTML-only content", async () => {
        const payload = {
          subject: "HTML Only Notification",
          contentHtml:
            "<h1>Important Notice</h1><p>Please read this carefully.</p>",
        };

        const result = await EmailService.sendGenericNotificationEmail(
          "user@example.com",
          "User Name",
          payload,
        );

        expect(result).toBe(true);
        expect(
          UtilityEmailService.sendGenericNotificationEmail,
        ).toHaveBeenCalledWith("user@example.com", "User Name", payload);
      });

      it("should handle attachments", async () => {
        const payload = {
          subject: "Notification with Attachment",
          contentHtml: "<p>Please see attached document.</p>",
          attachments: [
            {
              filename: "document.pdf",
              content: Buffer.from("PDF content"),
            },
          ],
        };

        const result = await EmailService.sendGenericNotificationEmail(
          "user@example.com",
          "User Name",
          payload,
        );

        expect(result).toBe(true);
        expect(
          UtilityEmailService.sendGenericNotificationEmail,
        ).toHaveBeenCalledWith("user@example.com", "User Name", payload);
      });

      it("should handle failure from UtilityEmailService", async () => {
        vi.mocked(
          UtilityEmailService.sendGenericNotificationEmail,
        ).mockResolvedValueOnce(false);

        const result = await EmailService.sendGenericNotificationEmail(
          "fail@example.com",
          "Fail",
          { subject: "Fail", contentHtml: "<p>Fail</p>" },
        );

        expect(result).toBe(false);
      });
    });
  });

  // ===== Static Helper Method Tests =====
  describe("Static Helper Methods", () => {
    describe("__clearDedupeCacheForTests", () => {
      it("should be callable without throwing", () => {
        expect(() => EmailService.__clearDedupeCacheForTests()).not.toThrow();
      });
    });
  });
});
