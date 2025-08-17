import { describe, it, expect, vi, beforeEach } from "vitest";

// Local mutable to simulate User.find().select() return value
let __userSelectResult: any[] = [];

// Mocks: infrastructure dependencies
vi.mock("../../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    // Role change emails
    sendPromotionNotificationToUser: vi.fn().mockResolvedValue(true),
    sendPromotionNotificationToAdmins: vi.fn().mockResolvedValue(true),
    sendDemotionNotificationToUser: vi.fn().mockResolvedValue(true),
    sendDemotionNotificationToAdmins: vi.fn().mockResolvedValue(true),
    // @Cloud role change emails
    sendNewAtCloudLeaderSignupToAdmins: vi.fn().mockResolvedValue(true),
    sendAtCloudRoleAssignedToAdmins: vi.fn().mockResolvedValue(true),
    sendAtCloudRoleRemovedToAdmins: vi.fn().mockResolvedValue(true),
    // Account status change emails
    sendUserDeactivatedAlertToAdmin: vi.fn().mockResolvedValue(true),
    sendUserReactivatedAlertToAdmin: vi.fn().mockResolvedValue(true),
    sendUserDeletedAlertToAdmin: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getSystemAuthorizationChangeRecipients: vi.fn().mockResolvedValue([
      { email: "admin1@example.com", firstName: "A", lastName: "One" },
      { email: "admin2@example.com", firstName: "B", lastName: "Two" },
    ]),
    getAdminUsers: vi.fn().mockResolvedValue([
      { email: "admin1@example.com", firstName: "A", lastName: "One" },
      { email: "admin2@example.com", firstName: "B", lastName: "Two" },
    ]),
  },
}));

vi.mock("../../../../src/controllers/unifiedMessageController", () => ({
  UnifiedMessageController: {
    createTargetedSystemMessage: vi.fn().mockResolvedValue({ id: "msg" }),
  },
}));

// Chainable User model mock used by service to resolve admin user IDs
vi.mock("../../../../src/models/User", () => ({
  default: {
    find: vi.fn(() => ({
      select: vi.fn().mockResolvedValue(__userSelectResult),
    })),
  },
}));

describe("AutoEmailNotificationService - admin message formatting", () => {
  let UnifiedMessageController: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    __userSelectResult = [
      {
        _id: "adm1",
        email: "admin1@example.com",
        firstName: "A",
        lastName: "One",
      },
      {
        _id: "adm2",
        email: "admin2@example.com",
        firstName: "B",
        lastName: "Two",
      },
    ];

    UnifiedMessageController = (
      await import("../../../../src/controllers/unifiedMessageController")
    ).UnifiedMessageController;
  });

  it("includes \nDate and \nReason in admin role-change message when reason provided", async () => {
    const { AutoEmailNotificationService } = await import(
      "../../../../src/services/infrastructure/autoEmailNotificationService"
    );

    await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "u1",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        oldRole: "Participant",
        newRole: "Leader",
      },
      changedBy: {
        _id: "sys",
        firstName: "System",
        lastName: "Admin",
        email: "sys@example.com",
        role: "Super Admin",
      },
      isPromotion: true,
      reason: "policy alignment",
    });

    const calls = (UnifiedMessageController.createTargetedSystemMessage as any)
      .mock.calls as any[];
    // Find the admin system message call (hideCreator: true)
    const adminCall = calls.find((args) => args?.[0]?.hideCreator === true);
    expect(adminCall).toBeTruthy();
    const adminPayload = adminCall[0];
    expect(adminPayload.content).toContain("\nDate: ");
    expect(adminPayload.content).toContain("\nReason: policy alignment");
  });

  it("includes \nDate and omits Reason line when reason is absent (role-change)", async () => {
    const { AutoEmailNotificationService } = await import(
      "../../../../src/services/infrastructure/autoEmailNotificationService"
    );

    await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "u1",
        firstName: "John",
        lastName: "Smith",
        email: "john@example.com",
        oldRole: "Leader",
        newRole: "Participant",
      },
      changedBy: {
        _id: "sys",
        firstName: "System",
        lastName: "Admin",
        email: "sys@example.com",
        role: "Super Admin",
      },
      isPromotion: false,
      // reason intentionally omitted
    });

    const calls = (UnifiedMessageController.createTargetedSystemMessage as any)
      .mock.calls as any[];
    const adminCall = calls.find((args) => args?.[0]?.hideCreator === true);
    const content = adminCall[0].content as string;
    expect(content).toContain("\nDate: ");
    expect(content).not.toContain("Reason:");
  });

  it("includes \nDate in admin @Cloud role-change messages (assigned)", async () => {
    const { AutoEmailNotificationService } = await import(
      "../../../../src/services/infrastructure/autoEmailNotificationService"
    );

    await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
      userData: {
        _id: "u2",
        firstName: "Alice",
        lastName: "W.",
        email: "alice@example.com",
        roleInAtCloud: "Co-worker",
      },
      changeType: "assigned",
      systemUser: {
        _id: "sys",
        firstName: "System",
        lastName: "Admin",
        email: "sys@example.com",
        role: "Super Admin",
      },
    });

    const calls = (UnifiedMessageController.createTargetedSystemMessage as any)
      .mock.calls as any[];
    const adminCall = calls.find(
      (args) => args?.[0]?.type === "atcloud_role_change"
    );
    const content = adminCall[0].content as string;
    expect(content).toContain("\nDate: ");
  });

  it("includes \nDate in admin account status messages (deactivated)", async () => {
    const { AutoEmailNotificationService } = await import(
      "../../../../src/services/infrastructure/autoEmailNotificationService"
    );

    await AutoEmailNotificationService.sendAccountStatusChangeAdminNotifications(
      {
        action: "deactivated",
        targetUser: {
          _id: "u3",
          firstName: "Bob",
          lastName: "K.",
          email: "bob@example.com",
        },
        actor: {
          _id: "sys",
          firstName: "System",
          lastName: "Admin",
          email: "sys@example.com",
          role: "Admin",
        },
      }
    );

    const calls = (UnifiedMessageController.createTargetedSystemMessage as any)
      .mock.calls as any[];
    const adminCall = calls.find(
      (args) => args?.[0]?.type === "user_management"
    );
    const content = adminCall[0].content as string;
    expect(content).toContain("\nDate: ");
  });
});
