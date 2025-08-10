import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoEmailNotificationService } from "../../../../src/services/infrastructure/autoEmailNotificationService";

vi.mock("../../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendPromotionNotificationToUser: vi.fn(),
    sendPromotionNotificationToAdmins: vi.fn(),
    sendDemotionNotificationToUser: vi.fn(),
    sendDemotionNotificationToAdmins: vi.fn(),
    // @Cloud role change admin email methods
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

// Mock dynamic User model import to avoid DB access in admin message creation paths
vi.mock("../../../../src/models/User", () => ({
  default: {
    find: vi.fn(() => ({
      select: vi.fn().mockResolvedValue([]),
    })),
  },
}));

describe("AutoEmailNotificationService - more branches", () => {
  const userData = {
    _id: "507f1f77bcf86cd799439011",
    firstName: "Test",
    lastName: "User",
    email: "user@example.com",
    oldRole: "Leader",
    newRole: "Participant",
  } as any;
  const changedBy = {
    firstName: "Admin",
    lastName: "One",
    email: "admin@example.com",
    role: "Administrator",
  } as any;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("promotion: admin message early-return when no admin users resolved -> messagesCreated only 1", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const UserModule = await import("../../../../src/models/User");

    // User email succeeds
    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    // No admin emails for role change flow
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);
    // Ensure createUserRoleChangeMessage succeeds but use real createAdminRoleChangeMessage (to hit early-return)
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    // Configure mocked User model to return empty admins so adminUserIds length === 0
    (UserModule.default.find as any).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    });
    // Also no admins from EmailRecipientUtils.getAdminUsers
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([]);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: { ...userData, newRole: "Administrator", oldRole: "Leader" },
      changedBy,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email
    expect(res.messagesCreated).toBe(1); // only user message; admin message early-returned
  });

  it("@Cloud signup: sends to admins and creates admin message when admin user IDs exist", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Two admins discovered
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
      { email: "a2@example.com", firstName: "B", lastName: "Two" },
    ]);
    // Email method for signup returns true for both calls
    (EmailService.sendNewAtCloudLeaderSignupToAdmins as any)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    // Mock User.find().select() to return two admin docs with _id strings
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "601111111111111111111111" } },
          { _id: { toString: () => "602222222222222222222222" } },
        ]),
    });
    // Prevent DB work in UnifiedMessageController by stubbing createTargetedSystemMessage
    vi.spyOn(
      UnifiedMessageController,
      "createTargetedSystemMessage"
    ).mockResolvedValue({ _id: "msg-admins" } as any);

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "u200",
          firstName: "Cloud",
          lastName: "User",
          email: "cloud.user@example.com",
          roleInAtCloud: "Coordinator",
        } as any,
        changeType: "signup",
        systemUser: {
          _id: "sys1",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin@example.com",
          role: "Super Admin",
        } as any,
      });

    expect(
      EmailService.sendNewAtCloudLeaderSignupToAdmins
    ).toHaveBeenCalledTimes(2);
    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(2);
    expect(res.messagesCreated).toBe(1);
  });

  it("demotion: admin emails succeed and admin message created with reason included", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Admin recipients for demotion emails
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
      { email: "a2@example.com", firstName: "B", lastName: "Two" },
    ]);
    // Also provide admin recipients for admin message creation path
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
      { email: "a2@example.com", firstName: "B", lastName: "Two" },
    ]);
    // Emails: user + both admins succeed
    (EmailService.sendDemotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (EmailService.sendDemotionNotificationToAdmins as any).mockResolvedValue(
      true
    );
    // Ensure admin message creation path finds admin IDs
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "700000000000000000000001" } },
          { _id: { toString: () => "700000000000000000000002" } },
        ]),
    });
    // Avoid real DB work in unified message creation
    vi.spyOn(
      UnifiedMessageController,
      "createTargetedSystemMessage"
    ).mockResolvedValue({ _id: "msg-admins" } as any);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "u300",
        firstName: "Demo",
        lastName: "Ted",
        email: "demo.ted@example.com",
        oldRole: "Leader",
        newRole: "Participant",
      } as any,
      changedBy: {
        _id: "sys1",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: false,
      reason: "policy update",
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(3); // user + 2 admins
    expect(res.messagesCreated).toBe(2); // user + admin message
  });

  it("@Cloud assigned: mixed admin email results and admin message early-return when no admin IDs", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const UserModule = await import("../../../../src/models/User");

    // Two admins discovered for email sending
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
      { email: "a2@example.com", firstName: "B", lastName: "Two" },
    ]);
    // First email succeeds, second rejects
    (EmailService.sendAtCloudRoleAssignedToAdmins as any)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("smtp fail"));

    // But User.find().select() returns empty -> no admin IDs, early return
    (UserModule.default.find as any).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    });

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "u400",
          firstName: "Cloud",
          lastName: "Assign",
          email: "cloud.assign@example.com",
          roleInAtCloud: "Coordinator",
        } as any,
        changeType: "assigned",
        systemUser: {
          _id: "sys2",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin2@example.com",
          role: "Super Admin",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // one success, one failure
    expect(res.messagesCreated).toBe(0); // early return due to no admin IDs
  });

  it("promotion: admin message creation fails (catch path) while user message succeeds", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Admin recipients for email sending
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    // Emails succeed
    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (EmailService.sendPromotionNotificationToAdmins as any).mockResolvedValue(
      true
    );
    // Admin users resolved for message creation
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "700000000000000000000009" } },
        ]),
    });

    // First createTargetedSystemMessage call (user message) resolves, second (admin) throws
    const msgSpy = vi.spyOn(
      UnifiedMessageController as any,
      "createTargetedSystemMessage"
    );
    msgSpy
      .mockResolvedValueOnce({ _id: "user-msg" } as any)
      .mockImplementationOnce(() => {
        throw new Error("admin msg fail");
      });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "u500",
        firstName: "Pro",
        lastName: "Mote",
        email: "pro.mote@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "sys3",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin3@example.com",
        role: "Super Admin",
      } as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(2);
    // Only user message counted; admin path failed and returned null
    expect(res.messagesCreated).toBe(1);
  });

  it("@Cloud assigned: uses fallback identity defaults when systemUser._id and gender are missing", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Admins discovered for email + message creation
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    (EmailService.sendAtCloudRoleAssignedToAdmins as any).mockResolvedValue(
      true
    );
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "733333333333333333333333" } },
        ]),
    });

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-ok" } as any);

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "u700",
          firstName: "A",
          lastName: "User",
          email: "a.user@example.com",
          roleInAtCloud: "Coordinator",
        } as any,
        changeType: "assigned",
        systemUser: {
          firstName: "Sys",
          lastName: "Admin",
          email: "sys.admin@example.com",
          role: "Super Admin",
          // no _id, no gender -> exercise fallbacks
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1);
    expect(res.messagesCreated).toBe(1);

    // Validate fallback fields used
    expect(spy).toHaveBeenCalledTimes(1);
    const args = (spy as any).mock.calls[0];
    const author = args[2];
    expect(author.id).toBe("system");
    expect(author.gender).toBe("male");
  });

  it("demotion: user email rejects (inner catch) but flow continues and returns success when messages succeed", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    // cause user email to reject to hit inner catch
    (EmailService.sendDemotionNotificationToUser as any).mockRejectedValue(
      new Error("smtp fail")
    );
    // no admin recipients
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // stub message creators to succeed
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m1" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m2" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData,
      changedBy,
      isPromotion: false,
      reason: "policy",
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(0);
    expect(res.messagesCreated).toBe(2);
  });

  it("promotion: zero admin recipients still resolves with success and counts only user email", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // stub message creators to avoid DB path
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m1" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m2" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: { ...userData, newRole: "Administrator", oldRole: "Leader" },
      changedBy,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email
    expect(res.messagesCreated).toBe(2);
  });

  it("demotion: admin recipients throws triggers catch; returns success and counts only user email", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    (EmailService.sendDemotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockRejectedValue(new Error("DB fail"));

    // allow messages to succeed without hitting DB
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m1" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m2" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData,
      changedBy,
      isPromotion: false,
      reason: "policy",
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email
    expect(res.messagesCreated).toBe(2);
  });

  it("@Cloud assigned: zero admins -> no emails and admin message early-return (messagesCreated 0)", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );

    // No admins discovered in email-sending phase
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([]);
    // Ensure email methods are not called (but safe if they are, they return undefined)
    (EmailService.sendAtCloudRoleAssignedToAdmins as any).mockResolvedValue(
      true
    );

    // The mocked User model returns [] by default via select(), triggering early return in admin message creation

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "u100",
          firstName: "Cloud",
          lastName: "User",
          email: "cloud.user@example.com",
          roleInAtCloud: "Coordinator",
        } as any,
        changeType: "assigned",
        systemUser: {
          _id: "sys1",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin@example.com",
          role: "Super Admin",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(0);
    expect(res.messagesCreated).toBe(0);

    // Verify no admin emails attempted due to zero recipients
    expect(EmailService.sendAtCloudRoleAssignedToAdmins).not.toHaveBeenCalled();
  });

  it("@Cloud removed: one admin success, one returns false; creates admin message and uses provided author fields", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Two admins discovered
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
      { email: "a2@example.com", firstName: "B", lastName: "Two" },
    ]);
    // First email resolves true, second resolves false -> exercise fulfilled:false path
    (EmailService.sendAtCloudRoleRemovedToAdmins as any)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    // Provide admin IDs so message creation proceeds
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "644444444444444444444441" } },
          { _id: { toString: () => "644444444444444444444442" } },
        ]),
    });

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-admins" } as any);

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "ux1",
          firstName: "Cloud",
          lastName: "Removed",
          email: "cloud.removed@example.com",
          previousRoleInAtCloud: "Coordinator",
        } as any,
        changeType: "removed",
        systemUser: {
          _id: "sysF",
          firstName: "Sys",
          lastName: "Female",
          email: "sys.female@example.com",
          role: "Super Admin",
          gender: "female",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // one true + one false
    expect(res.messagesCreated).toBe(1);

    // Ensure non-fallback author fields were used
    expect(spy).toHaveBeenCalledTimes(1);
    const args = (spy as any).mock.calls[0];
    const author = args[2];
    expect(author.id).toBe("sysF");
    expect(author.gender).toBe("female");
  });

  it("@Cloud: returns failure when changeData is invalid (outer catch path)", async () => {
    // Pass undefined to force destructuring to throw and hit the outer catch
    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification(
        undefined as any
      );
    expect(res.success).toBe(false);
    expect(res.emailsSent).toBe(0);
    expect(res.messagesCreated).toBe(0);
  });
});
