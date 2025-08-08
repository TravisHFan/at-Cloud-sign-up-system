import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Request, Response } from "express";
import { EmailNotificationController } from "../../../src/controllers/emailNotificationController";
import { EmailRecipientUtils } from "../../../src/utils/emailRecipientUtils";
import { EmailService } from "../../../src/services/infrastructure/emailService";
import { AutoEmailNotificationService } from "../../../src/services/infrastructure/autoEmailNotificationService";
import { RoleUtils } from "../../../src/utils/roleUtils";
import { UnifiedMessageController } from "../../../src/controllers/unifiedMessageController";
import { User } from "../../../src/models";
import { CachePatterns } from "../../../src/services";
import mongoose from "mongoose";

// Mock all dependencies
vi.mock("../../../src/utils/emailRecipientUtils");
vi.mock("../../../src/services/infrastructure/emailService");
vi.mock("../../../src/services/infrastructure/autoEmailNotificationService");
vi.mock("../../../src/utils/roleUtils");
vi.mock("../../../src/controllers/unifiedMessageController");
vi.mock("../../../src/models", () => ({
  User: {
    find: vi.fn(),
  },
}));
vi.mock("../../../src/services", () => ({
  CachePatterns: {
    invalidateEventCache: vi.fn(),
  },
}));

// Mock mongoose with importOriginal to preserve real Types.ObjectId
vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongoose")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      model: vi.fn(),
      models: {},
    },
    model: vi.fn(),
    models: {},
    Schema: class MockSchema {
      static Types = {
        ObjectId: "ObjectId",
      };

      constructor() {
        return {
          virtual: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
          }),
          pre: vi.fn().mockReturnThis(),
          post: vi.fn().mockReturnThis(),
          index: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          methods: {},
          statics: {},
        };
      }
    },
  };
});

describe("EmailNotificationController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStatus: any;
  let mockJson: any;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup console mocks to avoid test output clutter
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Setup response mocks
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendEventCreatedNotification", () => {
    beforeEach(() => {
      mockRequest = {
        body: {
          eventData: {
            title: "Test Event",
            date: "2024-01-15",
            time: "10:00 AM",
            location: "Test Location",
            organizerName: "Test Organizer",
            endTime: "11:00 AM",
            zoomLink: "https://zoom.us/test",
            purpose: "Test Purpose",
            format: "hybrid",
          },
          excludeEmail: "test@example.com",
        },
      };
    });

    it("should require authentication middleware (implicit)", async () => {
      // This test verifies the method exists and can be called
      expect(
        typeof EmailNotificationController.sendEventCreatedNotification
      ).toBe("function");
    });

    it("should require eventData with title and date", async () => {
      mockRequest.body = {};

      await EmailNotificationController.sendEventCreatedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Event data is required with title and date",
      });
    });

    it("should require title in eventData", async () => {
      mockRequest.body = {
        eventData: {
          date: "2024-01-15",
        },
      };

      await EmailNotificationController.sendEventCreatedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Event data is required with title and date",
      });
    });

    it("should require date in eventData", async () => {
      mockRequest.body = {
        eventData: {
          title: "Test Event",
        },
      };

      await EmailNotificationController.sendEventCreatedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Event data is required with title and date",
      });
    });

    it("should handle no eligible recipients", async () => {
      vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
        []
      );

      await EmailNotificationController.sendEventCreatedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "No eligible recipients found",
        recipientCount: 0,
      });
    });

    it("should send notifications to recipients successfully", async () => {
      const mockRecipients = [
        { email: "user1@example.com", firstName: "John", lastName: "Doe" },
        { email: "user2@example.com", firstName: "Jane", lastName: "Smith" },
      ];

      vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
        mockRecipients
      );
      vi.mocked(EmailService.sendEventCreatedEmail).mockResolvedValue(true);

      await EmailNotificationController.sendEventCreatedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailService.sendEventCreatedEmail).toHaveBeenCalledTimes(2);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Event creation notifications sent successfully",
        recipientCount: 2,
      });
    });

    it("should handle email service errors gracefully", async () => {
      const mockRecipients = [
        { email: "user1@example.com", firstName: "John", lastName: "Doe" },
      ];

      vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
        mockRecipients
      );
      vi.mocked(EmailService.sendEventCreatedEmail).mockRejectedValue(
        new Error("Email service error")
      );

      await EmailNotificationController.sendEventCreatedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Event creation notifications sent successfully",
        recipientCount: 1,
      });
    });

    it("should handle database errors", async () => {
      vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockRejectedValue(
        new Error("Database error")
      );

      await EmailNotificationController.sendEventCreatedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Failed to send event creation notifications",
        error: "Database error",
      });
    });

    it("should format email data correctly with defaults", async () => {
      const mockRecipients = [
        { email: "user1@example.com", firstName: "John", lastName: "Doe" },
      ];

      mockRequest.body = {
        eventData: {
          title: "Test Event",
          date: "2024-01-15",
          time: "10:00 AM",
          location: "Test Location",
          organizerName: "Test Organizer",
          // Missing optional fields
        },
      };

      vi.mocked(EmailRecipientUtils.getActiveVerifiedUsers).mockResolvedValue(
        mockRecipients
      );
      vi.mocked(EmailService.sendEventCreatedEmail).mockResolvedValue(true);

      await EmailNotificationController.sendEventCreatedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailService.sendEventCreatedEmail).toHaveBeenCalledWith(
        "user1@example.com",
        "John Doe",
        {
          title: "Test Event",
          date: "2024-01-15",
          time: "10:00 AM",
          endTime: "TBD",
          location: "Test Location",
          zoomLink: undefined,
          organizer: "Test Organizer",
          purpose: "",
          format: "",
        }
      );
    });
  });

  describe("sendSystemAuthorizationChangeNotification", () => {
    beforeEach(() => {
      mockRequest = {
        body: {
          userData: {
            _id: "507f1f77bcf86cd799439011",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            oldRole: "Member",
            newRole: "Admin",
          },
          changedBy: {
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
            role: "Super Admin",
            avatar: "/avatar.jpg",
            gender: "female",
          },
        },
      };
    });

    it("should require userData with all required fields", async () => {
      mockRequest.body = {};

      await EmailNotificationController.sendSystemAuthorizationChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "User data with ID, old role, and new role is required",
      });
    });

    it("should require oldRole and newRole", async () => {
      mockRequest.body = {
        userData: {
          _id: "507f1f77bcf86cd799439011",
        },
      };

      await EmailNotificationController.sendSystemAuthorizationChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "User data with ID, old role, and new role is required",
      });
    });

    it("should detect when no role change occurred", async () => {
      mockRequest.body.userData.oldRole = "Admin";
      mockRequest.body.userData.newRole = "Admin";

      vi.mocked(RoleUtils.isPromotion).mockReturnValue(false);
      vi.mocked(RoleUtils.isDemotion).mockReturnValue(false);

      await EmailNotificationController.sendSystemAuthorizationChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "No role change detected - old and new roles are the same",
      });
    });

    it("should handle promotion successfully", async () => {
      vi.mocked(RoleUtils.isPromotion).mockReturnValue(true);
      vi.mocked(RoleUtils.isDemotion).mockReturnValue(false);
      vi.mocked(
        AutoEmailNotificationService.sendRoleChangeNotification
      ).mockResolvedValue({
        success: true,
        emailsSent: 2,
        messagesCreated: 1,
      });

      await EmailNotificationController.sendSystemAuthorizationChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message:
          "🎉 Promotion notifications sent successfully (Email + System Message + Bell Notification)",
        data: {
          emailsSent: 2,
          systemMessagesCreated: 1,
          changeType: "promotion",
          unifiedMessaging: true,
        },
      });
    });

    it("should handle demotion successfully", async () => {
      vi.mocked(RoleUtils.isPromotion).mockReturnValue(false);
      vi.mocked(RoleUtils.isDemotion).mockReturnValue(true);
      vi.mocked(
        AutoEmailNotificationService.sendRoleChangeNotification
      ).mockResolvedValue({
        success: true,
        emailsSent: 1,
        messagesCreated: 1,
      });

      await EmailNotificationController.sendSystemAuthorizationChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message:
          "📋 Role change notifications sent successfully (Email + System Message + Bell Notification)",
        data: {
          emailsSent: 1,
          systemMessagesCreated: 1,
          changeType: "demotion",
          unifiedMessaging: true,
        },
      });
    });

    it("should handle AutoEmailNotificationService failure", async () => {
      vi.mocked(RoleUtils.isPromotion).mockReturnValue(true);
      vi.mocked(RoleUtils.isDemotion).mockReturnValue(false);
      vi.mocked(
        AutoEmailNotificationService.sendRoleChangeNotification
      ).mockResolvedValue({
        success: false,
        emailsSent: 0,
        messagesCreated: 0,
      });

      await EmailNotificationController.sendSystemAuthorizationChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Failed to send role change notifications",
      });
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(RoleUtils.isPromotion).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await EmailNotificationController.sendSystemAuthorizationChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Failed to send role change notifications",
        error: "Unexpected error",
      });
    });
  });

  describe("sendAtCloudRoleChangeNotification", () => {
    beforeEach(() => {
      mockRequest = {
        body: {
          userData: {
            _id: "507f1f77bcf86cd799439011",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            oldRoleInAtCloud: "Member",
            newRoleInAtCloud: "Leader",
          },
        },
      };
    });

    it("should require userData with all required fields", async () => {
      mockRequest.body = {};

      await EmailNotificationController.sendAtCloudRoleChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "User data with ID, old role, and new role is required",
      });
    });

    it("should detect when no ministry role change occurred", async () => {
      mockRequest.body.userData.oldRoleInAtCloud = "Leader";
      mockRequest.body.userData.newRoleInAtCloud = "Leader";

      await EmailNotificationController.sendAtCloudRoleChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message:
          "No ministry role change detected - old and new roles are the same",
      });
    });

    it("should send notifications successfully", async () => {
      const mockAdmins = [
        {
          email: "admin1@example.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
        {
          email: "admin2@example.com",
          firstName: "Admin",
          lastName: "Two",
          role: "Admin",
        },
      ];

      vi.mocked(EmailService.sendAtCloudRoleChangeToUser).mockResolvedValue(
        true
      );
      vi.mocked(
        EmailRecipientUtils.getSystemAuthorizationChangeRecipients
      ).mockResolvedValue(mockAdmins);
      vi.mocked(EmailService.sendAtCloudRoleChangeToAdmins).mockResolvedValue(
        true
      );

      await EmailNotificationController.sendAtCloudRoleChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Ministry role change notifications sent to 3 recipient(s)",
        recipientCount: 3,
        data: {
          userNotified: true,
          adminCount: 2,
          totalAdmins: 2,
          oldRole: "Member",
          newRole: "Leader",
        },
      });
    });

    it("should handle user email failure", async () => {
      const mockAdmins = [
        {
          email: "admin1@example.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
      ];

      vi.mocked(EmailService.sendAtCloudRoleChangeToUser).mockResolvedValue(
        false
      );
      vi.mocked(
        EmailRecipientUtils.getSystemAuthorizationChangeRecipients
      ).mockResolvedValue(mockAdmins);
      vi.mocked(EmailService.sendAtCloudRoleChangeToAdmins).mockResolvedValue(
        true
      );

      await EmailNotificationController.sendAtCloudRoleChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Ministry role change notifications sent to 1 recipient(s)",
        recipientCount: 1,
        data: {
          userNotified: false,
          adminCount: 1,
          totalAdmins: 1,
          oldRole: "Member",
          newRole: "Leader",
        },
      });
    });

    it("should handle admin email failures", async () => {
      const mockAdmins = [
        {
          email: "admin1@example.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
        {
          email: "admin2@example.com",
          firstName: "Admin",
          lastName: "Two",
          role: "Admin",
        },
      ];

      vi.mocked(EmailService.sendAtCloudRoleChangeToUser).mockResolvedValue(
        true
      );
      vi.mocked(
        EmailRecipientUtils.getSystemAuthorizationChangeRecipients
      ).mockResolvedValue(mockAdmins);
      vi.mocked(EmailService.sendAtCloudRoleChangeToAdmins)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await EmailNotificationController.sendAtCloudRoleChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Ministry role change notifications sent to 2 recipient(s)",
        recipientCount: 2,
        data: {
          userNotified: true,
          adminCount: 1,
          totalAdmins: 2,
          oldRole: "Member",
          newRole: "Leader",
        },
      });
    });

    it("should handle database errors", async () => {
      vi.mocked(EmailService.sendAtCloudRoleChangeToUser).mockRejectedValue(
        new Error("Database error")
      );

      await EmailNotificationController.sendAtCloudRoleChangeNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Failed to send ministry role change notifications",
        error: "Database error",
      });
    });
  });

  describe("sendNewLeaderSignupNotification", () => {
    beforeEach(() => {
      mockRequest = {
        body: {
          userData: {
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            roleInAtCloud: "Leader",
          },
        },
      };
    });

    it("should require userData with required fields", async () => {
      mockRequest.body = {};

      await EmailNotificationController.sendNewLeaderSignupNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "User data with email and name is required",
      });
    });

    it("should handle no admin recipients", async () => {
      vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue([]);

      await EmailNotificationController.sendNewLeaderSignupNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "New leader signup notification sent to 0 recipient(s)",
        recipientCount: 0,
      });
    });

    it("should send notifications to admins successfully", async () => {
      const mockAdmins = [
        {
          email: "admin1@example.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
        {
          email: "admin2@example.com",
          firstName: "Admin",
          lastName: "Two",
          role: "Admin",
        },
      ];
      const mockUserDocuments = [{ _id: "admin1_id" }, { _id: "admin2_id" }];

      vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
        mockAdmins
      );
      vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(true);
      vi.mocked(User.find).mockResolvedValue(mockUserDocuments);
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(undefined);

      await EmailNotificationController.sendNewLeaderSignupNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailService.sendNewLeaderSignupEmail).toHaveBeenCalledTimes(2);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "New leader signup notification sent to 2 recipient(s)",
        recipientCount: 2,
      });
    });

    it("should handle email failures gracefully", async () => {
      const mockAdmins = [
        {
          email: "admin1@example.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
      ];

      vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
        mockAdmins
      );
      vi.mocked(EmailService.sendNewLeaderSignupEmail).mockRejectedValue(
        new Error("Email failed")
      );
      vi.mocked(User.find).mockResolvedValue([]);

      await EmailNotificationController.sendNewLeaderSignupNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "New leader signup notification sent to 0 recipient(s)",
        recipientCount: 0,
      });
    });

    it("should handle system message creation failure gracefully", async () => {
      const mockAdmins = [
        {
          email: "admin1@example.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
      ];

      vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
        mockAdmins
      );
      vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(true);
      vi.mocked(User.find).mockRejectedValue(new Error("Database error"));

      await EmailNotificationController.sendNewLeaderSignupNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "New leader signup notification sent to 1 recipient(s)",
        recipientCount: 1,
      });
    });

    it("should handle database errors", async () => {
      vi.mocked(EmailRecipientUtils.getAdminUsers).mockRejectedValue(
        new Error("Database error")
      );

      await EmailNotificationController.sendNewLeaderSignupNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Failed to send new leader signup notifications",
        error: "Database error",
      });
    });

    it("should use default values for missing optional fields", async () => {
      mockRequest.body = {
        userData: {
          firstName: "John",
          email: "john@example.com",
          // Missing lastName and roleInAtCloud
        },
      };

      const mockAdmins = [
        {
          email: "admin1@example.com",
          firstName: "Admin",
          lastName: "One",
          role: "Super Admin",
        },
      ];

      vi.mocked(EmailRecipientUtils.getAdminUsers).mockResolvedValue(
        mockAdmins
      );
      vi.mocked(EmailService.sendNewLeaderSignupEmail).mockResolvedValue(true);
      vi.mocked(User.find).mockResolvedValue([]);

      await EmailNotificationController.sendNewLeaderSignupNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailService.sendNewLeaderSignupEmail).toHaveBeenCalledWith(
        "admin1@example.com",
        "Admin One",
        expect.objectContaining({
          firstName: "John",
          lastName: "",
          email: "john@example.com",
          roleInAtCloud: "Leader",
        })
      );
    });
  });

  describe("sendCoOrganizerAssignedNotification", () => {
    beforeEach(() => {
      mockRequest = {
        body: {
          assignedUser: {
            email: "organizer@example.com",
            firstName: "John",
            lastName: "Doe",
          },
          eventData: {
            title: "Test Event",
            date: "2024-01-15",
            time: "10:00 AM",
            location: "Test Location",
          },
          assignedBy: {
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
          },
        },
      };
    });

    it("should require assignedUser and eventData", async () => {
      mockRequest.body = {};

      await EmailNotificationController.sendCoOrganizerAssignedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Assigned user and event data are required",
      });
    });

    it("should require assignedBy information", async () => {
      delete mockRequest.body.assignedBy;

      await EmailNotificationController.sendCoOrganizerAssignedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Assigned by information is required",
      });
    });

    it("should send notification successfully", async () => {
      vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
        true
      );

      await EmailNotificationController.sendCoOrganizerAssignedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
        "organizer@example.com",
        { firstName: "John", lastName: "Doe" },
        {
          title: "Test Event",
          date: "2024-01-15",
          time: "10:00 AM",
          location: "Test Location",
        },
        { firstName: "Jane", lastName: "Smith" }
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Co-organizer assignment notification sent to 1 recipient(s)",
        recipientCount: 1,
      });
    });

    it("should handle email failure", async () => {
      vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
        false
      );

      await EmailNotificationController.sendCoOrganizerAssignedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Co-organizer assignment notification sent to 0 recipient(s)",
        recipientCount: 0,
      });
    });

    it("should use default values for missing fields", async () => {
      mockRequest.body = {
        assignedUser: {
          email: "organizer@example.com",
          firstName: "John",
          // Missing lastName
        },
        eventData: {
          title: "Test Event",
          // Missing optional fields
        },
        assignedBy: {
          firstName: "Jane",
          // Missing lastName
        },
      };

      vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockResolvedValue(
        true
      );

      await EmailNotificationController.sendCoOrganizerAssignedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailService.sendCoOrganizerAssignedEmail).toHaveBeenCalledWith(
        "organizer@example.com",
        { firstName: "John", lastName: "" },
        { title: "Test Event", date: "TBD", time: "TBD", location: "TBD" },
        { firstName: "Jane", lastName: "" }
      );
    });

    it("should handle database errors", async () => {
      vi.mocked(EmailService.sendCoOrganizerAssignedEmail).mockRejectedValue(
        new Error("Database error")
      );

      await EmailNotificationController.sendCoOrganizerAssignedNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Failed to send co-organizer assignment notification",
        error: "Database error",
      });
    });
  });

  describe("sendEventReminderNotification", () => {
    const mockEventModel = {
      findOneAndUpdate: vi.fn(),
    };

    beforeEach(() => {
      mockRequest = {
        body: {
          eventId: "507f1f77bcf86cd799439011",
          eventData: {
            title: "Test Event",
            date: "2024-01-15",
            time: "10:00 AM",
            location: "Test Location",
            zoomLink: "https://zoom.us/test",
            format: "hybrid",
          },
          reminderType: "24h",
        },
      };

      vi.mocked(mongoose.model).mockReturnValue(mockEventModel as any);
    });

    it("should require eventId and eventData", async () => {
      mockRequest.body = {};

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Event ID and event data are required",
      });
    });

    it("should validate reminder type", async () => {
      mockRequest.body.reminderType = "invalid";

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Invalid reminder type. Must be '1h', '24h', or '1week'",
      });
    });

    it("should handle duplicate 24h reminder prevention", async () => {
      mockEventModel.findOneAndUpdate.mockResolvedValue(null); // Already sent

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "24h reminder already sent for this event",
        alreadySent: true,
        preventedDuplicate: true,
      });
    });

    it("should handle no participants found", async () => {
      mockEventModel.findOneAndUpdate.mockResolvedValue({ _id: "event123" }); // Success
      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue([]);
      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined
      );

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Event reminder notification sent to 0 recipient(s)",
        recipientCount: 0,
      });
    });

    it("should send reminders successfully", async () => {
      const mockParticipants = [
        {
          email: "user1@example.com",
          firstName: "John",
          lastName: "Doe",
          _id: "user1_id",
        },
        {
          email: "user2@example.com",
          firstName: "Jane",
          lastName: "Smith",
          _id: "user2_id",
        },
      ];

      mockEventModel.findOneAndUpdate.mockResolvedValue({ _id: "event123" });
      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);
      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(undefined);

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailService.sendEventReminderEmail).toHaveBeenCalledTimes(2);
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Event Reminder: Test Event",
          type: "announcement",
          priority: "medium",
        }),
        ["user1_id", "user2_id"],
        expect.any(Object)
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Event reminder notification sent to 2 recipient(s)",
        recipientCount: 2,
        systemMessageCreated: true,
        details: {
          emailsSent: 2,
          totalParticipants: 2,
          systemMessageSuccess: true,
        },
      });
    });

    it("should handle email failures gracefully", async () => {
      const mockParticipants = [
        {
          email: "user1@example.com",
          firstName: "John",
          lastName: "Doe",
          _id: "user1_id",
        },
      ];

      mockEventModel.findOneAndUpdate.mockResolvedValue({ _id: "event123" });
      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockRejectedValue(
        new Error("Email failed")
      );
      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(undefined);

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Event reminder notification sent to 0 recipient(s)",
        recipientCount: 0,
        systemMessageCreated: true,
        details: {
          emailsSent: 0,
          totalParticipants: 1,
          systemMessageSuccess: true,
        },
      });
    });

    it("should handle system message creation failure gracefully", async () => {
      const mockParticipants = [
        {
          email: "user1@example.com",
          firstName: "John",
          lastName: "Doe",
          _id: "user1_id",
        },
      ];

      mockEventModel.findOneAndUpdate.mockResolvedValue({ _id: "event123" });
      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);
      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockRejectedValue(new Error("System message failed"));

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Event reminder notification sent to 1 recipient(s)",
        recipientCount: 1,
        systemMessageCreated: false,
        details: {
          emailsSent: 1,
          totalParticipants: 1,
          systemMessageSuccess: false,
        },
      });
    });

    it("should use default values for missing fields", async () => {
      mockRequest.body = {
        eventId: "507f1f77bcf86cd799439011",
        eventData: {
          title: "Test Event",
          // Missing optional fields
        },
        // Missing reminderType
      };

      const mockParticipants = [
        {
          email: "user1@example.com",
          firstName: "John",
          lastName: "Doe",
          _id: "user1_id",
        },
      ];

      mockEventModel.findOneAndUpdate.mockResolvedValue({ _id: "event123" });
      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);
      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(undefined);

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(EmailService.sendEventReminderEmail).toHaveBeenCalledWith(
        "user1@example.com",
        "John Doe",
        {
          title: "Test Event",
          date: "TBD",
          time: "TBD",
          location: "TBD",
          zoomLink: undefined,
          format: "in-person",
        },
        "24h"
      );
    });

    it("should handle database errors", async () => {
      // Make sure atomic check succeeds first
      mockEventModel.findOneAndUpdate.mockResolvedValue({ _id: "event123" });
      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined
      );
      // Then fail on getEventParticipants
      vi.mocked(EmailRecipientUtils.getEventParticipants).mockRejectedValue(
        new Error("Database error")
      );

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: "Failed to send event reminder notifications",
        error: "Database error",
      });
    });

    it("should handle atomic deduplication check failure gracefully", async () => {
      mockEventModel.findOneAndUpdate.mockRejectedValue(
        new Error("Database connection failed")
      );

      const mockParticipants = [
        {
          email: "user1@example.com",
          firstName: "John",
          lastName: "Doe",
          _id: "user1_id",
        },
      ];

      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(undefined);

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should continue processing despite atomic check failure
      expect(EmailService.sendEventReminderEmail).toHaveBeenCalledTimes(1);
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it("should handle participants with undefined IDs", async () => {
      const mockParticipants = [
        {
          email: "user1@example.com",
          firstName: "John",
          lastName: "Doe",
          _id: "user1_id",
        },
        { email: "user2@example.com", firstName: "Jane", lastName: "Smith" }, // No _id
      ];

      mockEventModel.findOneAndUpdate.mockResolvedValue({ _id: "event123" });
      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);
      vi.mocked(CachePatterns.invalidateEventCache).mockResolvedValue(
        undefined
      );
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(undefined);

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should filter out undefined IDs and only pass valid ones
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledWith(
        expect.any(Object),
        ["user1_id"], // Only user1_id, not user2 (undefined)
        expect.any(Object)
      );
    });

    it("should work with non-24h reminder types without atomic check", async () => {
      mockRequest.body.reminderType = "1h";

      const mockParticipants = [
        {
          email: "user1@example.com",
          firstName: "John",
          lastName: "Doe",
          _id: "user1_id",
        },
      ];

      vi.mocked(EmailRecipientUtils.getEventParticipants).mockResolvedValue(
        mockParticipants
      );
      vi.mocked(EmailService.sendEventReminderEmail).mockResolvedValue(true);
      vi.mocked(
        UnifiedMessageController.createTargetedSystemMessage
      ).mockResolvedValue(undefined);

      await EmailNotificationController.sendEventReminderNotification(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should not call mongoose model for non-24h reminders
      expect(mongoose.model).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(200);
    });
  });
});
