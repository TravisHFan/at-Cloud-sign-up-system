import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Mutable store used by the User model mock for chainable select()
let __userSelectResult: any[] = [];

// Mocks for heavy/static imports used by the service
vi.mock("../../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendPromotionNotificationToUser: vi.fn(),
    sendPromotionNotificationToAdmins: vi.fn(),
    sendDemotionNotificationToUser: vi.fn(),
    sendDemotionNotificationToAdmins: vi.fn(),
    sendNewAtCloudLeaderSignupToAdmins: vi.fn(),
    sendAtCloudRoleAssignedToAdmins: vi.fn(),
    sendAtCloudRoleRemovedToAdmins: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getSystemAuthorizationChangeRecipients: vi.fn(),
    getAdminUsers: vi.fn(),
  },
}));

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue({ id: "msg1" }),
  },
}));

vi.mock("../../../../src/models/Message", () => ({ default: {} }));
vi.mock("../../../../src/services/infrastructure/SocketService", () => ({
  socketService: { emit: vi.fn() },
}));

// Chainable User model mock used by createAdminRoleChangeMessage and the @Cloud admin message
vi.mock("../../../../src/models/User", () => ({
  default: {
    find: vi.fn(() => ({
      select: vi.fn().mockResolvedValue(__userSelectResult),
    })),
  },
}));

describe("AutoEmailNotificationService", () => {
  let EmailService: any;
  let EmailRecipientUtils: any;
  let UnifiedMessageController: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Load mocked modules
    EmailService = (
      await import("../../../../src/services/infrastructure/emailService")
    ).EmailService;
    EmailRecipientUtils = (
      await import("../../../../src/utils/emailRecipientUtils")
    ).EmailRecipientUtils;
    // No need to import User model directly; it's dynamically imported by the SUT
    UnifiedMessageController = (
      await import("../../../../src/controllers/unifiedMessageController")
    ).UnifiedMessageController;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Service Structure Validation", () => {
    it("exposes expected static methods", async () => {
      const serviceModule = await import(
        "../../../../src/services/infrastructure/autoEmailNotificationService"
      );
      const service = serviceModule.AutoEmailNotificationService;
      expect(typeof service.sendRoleChangeNotification).toBe("function");
      expect(typeof service.sendAtCloudRoleChangeNotification).toBe("function");
    });
  });

  describe("sendRoleChangeNotification", () => {
    it("handles promotion: sends user + admin emails and creates both messages", async () => {
      // Arrange
      // Admin recipients for emails
      EmailRecipientUtils.getAdminUsers.mockResolvedValue([
        {
          email: "a1@x.com",
          firstName: "A1",
          lastName: "X",
          role: "Administrator",
        },
        {
          email: "a2@x.com",
          firstName: "A2",
          lastName: "Y",
          role: "Super Admin",
        },
      ]);
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients.mockResolvedValue(
        [
          {
            email: "a1@x.com",
            firstName: "A1",
            lastName: "X",
            role: "Administrator",
          },
          {
            email: "a2@x.com",
            firstName: "A2",
            lastName: "Y",
            role: "Super Admin",
          },
        ]
      );
      EmailService.sendPromotionNotificationToUser.mockResolvedValue(true);
      EmailService.sendPromotionNotificationToAdmins.mockResolvedValue(true);
      // Dynamic import of User.find().select() will resolve to this list
      __userSelectResult = [
        { _id: "id1", email: "a1@x.com", firstName: "A1", lastName: "X" },
        { _id: "id2", email: "a2@x.com", firstName: "A2", lastName: "Y" },
      ];

      const serviceModule = await import(
        "../../../../src/services/infrastructure/autoEmailNotificationService"
      );
      const service = serviceModule.AutoEmailNotificationService;

      // Act
      const res = await service.sendRoleChangeNotification({
        userData: {
          _id: "u1",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@x.com",
          oldRole: "Participant",
          newRole: "Leader",
        },
        changedBy: {
          _id: "admin1",
          firstName: "System",
          lastName: "Admin",
          email: "admin@x.com",
          role: "Super Admin",
        },
        isPromotion: true,
      });

      // Assert
      expect(res.success).toBe(true);
      // 1 user email + 2 admin emails
      expect(res.emailsSent).toBe(3);
      // user message + admin message
      expect(res.messagesCreated).toBe(2);
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledTimes(2);
    });

    it("handles demotion with admin email failures; still creates messages", async () => {
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients.mockResolvedValue(
        [
          {
            email: "a1@x.com",
            firstName: "A1",
            lastName: "X",
            role: "Administrator",
          },
          {
            email: "a2@x.com",
            firstName: "A2",
            lastName: "Y",
            role: "Super Admin",
          },
        ]
      );
      EmailService.sendDemotionNotificationToUser.mockResolvedValue(true);
      // Admin emails reject -> counted as 0
      EmailService.sendDemotionNotificationToAdmins.mockRejectedValue(
        new Error("SMTP down")
      );
      // No admin users found by IDs -> still creates user message; admin message path will return null
      __userSelectResult = [];

      const serviceModule = await import(
        "../../../../src/services/infrastructure/autoEmailNotificationService"
      );
      const service = serviceModule.AutoEmailNotificationService;

      const res = await service.sendRoleChangeNotification({
        userData: {
          _id: "u1",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@x.com",
          oldRole: "Leader",
          newRole: "Participant",
        },
        changedBy: {
          _id: "admin1",
          firstName: "System",
          lastName: "Admin",
          email: "admin@x.com",
          role: "Super Admin",
        },
        reason: "Policy violation",
        isPromotion: false,
      });

      expect(res.success).toBe(true);
      // 1 user email success, 0 admin successes
      expect(res.emailsSent).toBe(1);
      // user message created, admin message skipped => 1
      expect(res.messagesCreated).toBe(1);
    });
  });

  describe("sendAtCloudRoleChangeNotification", () => {
    it("sends emails to admins and creates admin message (assigned)", async () => {
      // Admin discovery
      const admins = [
        {
          email: "a1@x.com",
          firstName: "A1",
          lastName: "X",
          role: "Administrator",
        },
        {
          email: "a2@x.com",
          firstName: "A2",
          lastName: "Y",
          role: "Super Admin",
        },
      ];
      EmailRecipientUtils.getAdminUsers.mockResolvedValue(admins);

      // Each admin email resolves true
      EmailService.sendAtCloudRoleAssignedToAdmins.mockResolvedValue(true);

      // Dynamic import of User.find().select() => materialize admin ids
      __userSelectResult = [
        { _id: "id1", email: "a1@x.com", firstName: "A1", lastName: "X" },
        { _id: "id2", email: "a2@x.com", firstName: "A2", lastName: "Y" },
      ];

      const serviceModule = await import(
        "../../../../src/services/infrastructure/autoEmailNotificationService"
      );
      const service = serviceModule.AutoEmailNotificationService;

      const res = await service.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "u2",
          firstName: "John",
          lastName: "Leader",
          email: "john@x.com",
          roleInAtCloud: "Team Lead",
        },
        changeType: "assigned",
        systemUser: {
          _id: "admin1",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin@x.com",
          role: "Super Admin",
        },
      });

      expect(res.success).toBe(true);
      expect(res.emailsSent).toBe(2);
      expect(res.messagesCreated).toBe(1);
      expect(
        EmailService.sendAtCloudRoleAssignedToAdmins
      ).toHaveBeenCalledTimes(2);
      expect(
        UnifiedMessageController.createTargetedSystemMessage
      ).toHaveBeenCalledTimes(1);
    });

    it("handles removed: email failures but still creates admin message", async () => {
      EmailRecipientUtils.getAdminUsers.mockResolvedValue([
        {
          email: "a1@x.com",
          firstName: "A1",
          lastName: "X",
          role: "Administrator",
        },
      ]);
      EmailService.sendAtCloudRoleRemovedToAdmins.mockRejectedValue(
        new Error("SMTP down")
      );
      __userSelectResult = [
        { _id: "id1", email: "a1@x.com", firstName: "A1", lastName: "X" },
      ];

      const serviceModule = await import(
        "../../../../src/services/infrastructure/autoEmailNotificationService"
      );
      const service = serviceModule.AutoEmailNotificationService;

      const res = await service.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "u3",
          firstName: "John",
          lastName: "Leader",
          email: "john@x.com",
          previousRoleInAtCloud: "Team Lead",
        },
        changeType: "removed",
        systemUser: {
          _id: "admin1",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin@x.com",
          role: "Super Admin",
        },
      });

      expect(res.success).toBe(true);
      expect(res.emailsSent).toBe(0);
      expect(res.messagesCreated).toBe(1);
    });
  });
});
