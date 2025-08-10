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

  it("demotion: zero admin recipients -> counts only user email and still creates both messages", async () => {
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
      userData: {
        _id: "uZD1",
        firstName: "De",
        lastName: "Motion",
        email: "de.motion@example.com",
        oldRole: "Leader",
        newRole: "Member",
      } as any,
      changedBy: {
        _id: "sysZ",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: false,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email
    expect(res.messagesCreated).toBe(2); // both messages via stubs
  });

  it("demotion: admin email returns false is not counted; only user email counted", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValueOnce([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    (EmailService.sendDemotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (
      EmailService.sendDemotionNotificationToAdmins as any
    ).mockResolvedValueOnce(false);

    // stub messages to succeed
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m1" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m2" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uDF1",
        firstName: "De",
        lastName: "Motion",
        email: "de.motion@example.com",
        oldRole: "Leader",
        newRole: "Member",
      } as any,
      changedBy: {
        _id: "sysD2",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: false,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // user true + admin false -> 1
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

  it("promotion: admin email returns false is not counted; only user email counted", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    // One admin recipient
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValueOnce([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    // User email true; admin email returns false
    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (
      EmailService.sendPromotionNotificationToAdmins as any
    ).mockResolvedValueOnce(false);

    // Stub messages to avoid DB
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m1" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m2" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uP1",
        firstName: "Pro",
        lastName: "User",
        email: "pro.user@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "sysX",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: true,
    });

    // Only user email counted
    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1);
    expect(res.messagesCreated).toBe(2);
  });

  it("demotion: user email times out -> not counted; admin email true counted", async () => {
    vi.useFakeTimers();
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    // Admin recipient for demotion
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([{ email: "admin1@example.com" }]);

    // User email never resolves -> timeout
    (EmailService.sendDemotionNotificationToUser as any).mockReturnValue(
      new Promise(() => {})
    );
    // Admin email resolves true
    (EmailService.sendDemotionNotificationToAdmins as any).mockResolvedValue(
      true
    );

    // Avoid DB by stubbing message creators
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m1" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m2" });

    const promise = AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uD1",
        firstName: "De",
        lastName: "Motion",
        email: "de.motion@example.com",
        oldRole: "Leader",
        newRole: "Member",
      } as any,
      changedBy: {
        _id: "sysD",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: false,
      reason: "policy",
    });

    await vi.advanceTimersByTimeAsync(10000);
    const res = await promise;

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only admin counted
    expect(res.messagesCreated).toBe(2);
    vi.useRealTimers();
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

  it("promotion: user email times out; zero admin recipients -> emailsSent 0; messages still created", async () => {
    vi.useFakeTimers();
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    // User email never resolves -> triggers timeout branch and inner catch
    (EmailService.sendPromotionNotificationToUser as any).mockReturnValue(
      new Promise(() => {})
    );
    // No admins for email-sending phase
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // Stub message creators to avoid DB and count both messages
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-admins" });

    const promise = AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uTP1",
        firstName: "Time",
        lastName: "Out",
        email: "timeout@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "sysT",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: true,
    });

    await vi.advanceTimersByTimeAsync(10000);
    const res = await promise;
    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(0); // user timed out, no admins
    expect(res.messagesCreated).toBe(2);
    vi.useRealTimers();
  });

  it("promotion: admin recipients fetch throws -> only user email counted; flow continues", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    // Throw when fetching admin recipients for role-change email phase
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockRejectedValue(new Error("DB fail"));

    // Stub message creators to succeed
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-admins" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uPR1",
        firstName: "Pro",
        lastName: " M",
        email: "pro.m@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "sysPR",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email counted
    expect(res.messagesCreated).toBe(2);
  });

  it("@Cloud: email-sending getAdminUsers throws but admin message creation still succeeds", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // First call (email-sending phase) throws, second call (message creation) resolves
    (EmailRecipientUtils.getAdminUsers as any)
      .mockRejectedValueOnce(new Error("DB fail"))
      .mockResolvedValueOnce([
        { email: "a1@example.com", firstName: "A", lastName: "One" },
      ]);

    // Provide admin user id for message creation path
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "744444444444444444444441" } },
        ]),
    });

    // Stub targeted message creation
    vi.spyOn(
      UnifiedMessageController,
      "createTargetedSystemMessage"
    ).mockResolvedValue({ _id: "msg-admins" } as any);

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "ux2",
          firstName: "Cloud",
          lastName: "User",
          email: "cloud.user@example.com",
          roleInAtCloud: "Coordinator",
        } as any,
        changeType: "assigned",
        systemUser: {
          _id: "sysG",
          firstName: "Sys",
          lastName: "Admin",
          email: "sys.admin@example.com",
          role: "Super Admin",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(0); // email-sending phase failed entirely
    expect(res.messagesCreated).toBe(1); // admin message still created
  });

  it("promotion: user system message creation fails (catch) but admin message succeeds", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // User email succeeds; skip admin email sending by returning [] for recipients
    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // Admins exist for message creation path
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "755555555555555555555551" } },
        ]),
    });

    // First call (user message) throws; second call (admin message) succeeds
    const spy = vi.spyOn(
      UnifiedMessageController,
      "createTargetedSystemMessage"
    );
    spy
      .mockImplementationOnce(() => {
        throw new Error("user message create failed");
      })
      .mockResolvedValueOnce({ _id: "admin-msg" } as any);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uUX1",
        firstName: "Role",
        lastName: "Promo",
        email: "role.promo@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "sysUX",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email counted
    expect(res.messagesCreated).toBe(1); // user message failed, admin message succeeded
  });

  it("@Cloud assigned: User.find throws during admin message creation -> emailsSent counted, messagesCreated 0", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const UserModule = await import("../../../../src/models/User");

    // Email-sending phase: two admins, both succeed
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
      { email: "a2@example.com", firstName: "B", lastName: "Two" },
    ]);
    (EmailService.sendAtCloudRoleAssignedToAdmins as any)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    // Message creation phase: make User.find throw to hit catch and return null
    (UserModule.default.find as any).mockImplementation(() => {
      throw new Error("DB explode");
    });

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "uCATCH1",
          firstName: "Cloud",
          lastName: "User",
          email: "cloud.user@example.com",
          roleInAtCloud: "Coordinator",
        } as any,
        changeType: "assigned",
        systemUser: {
          _id: "sysC",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin@example.com",
          role: "Super Admin",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(2);
    expect(res.messagesCreated).toBe(0);
  });

  it("demotion: admin email rejects (timeout/failure) while user email succeeds -> emailsSent only user; messagesCreated only user", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    // User demotion email succeeds
    (EmailService.sendDemotionNotificationToUser as any).mockResolvedValue(
      true
    );
    // One admin recipient discovered for role-change flow
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    // Admin email rejects (simulates Promise.race rejection path)
    (EmailService.sendDemotionNotificationToAdmins as any).mockRejectedValue(
      new Error("timeout")
    );

    // Ensure user message is created successfully
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    // Admin message creation early-return by supplying no admin users
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([]);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: { ...userData, oldRole: "Leader", newRole: "Member" },
      changedBy,
      reason: "policy update",
      isPromotion: false,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email counted
    expect(res.messagesCreated).toBe(1); // only user message created
  });

  it("demotion: user email rejects with a string (non-Error) -> inner catch uses fallback; messages still created", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    // Reject with plain string to exercise error?.message || error in demotion user path
    (EmailService.sendDemotionNotificationToUser as any).mockRejectedValue(
      "smtp unavailable"
    );
    // No admin recipients to keep this focused on user branch
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // Stub message creators to ensure messagesCreated counts
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-admin" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uSTRD1",
        firstName: "De",
        lastName: "Motion",
        email: "de.motion@example.com",
        oldRole: "Leader",
        newRole: "Member",
      } as any,
      changedBy: {
        _id: "sysSTRD",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: false,
      reason: "policy",
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(0);
    expect(res.messagesCreated).toBe(2);
  });

  it("demotion: admin recipients fetch rejects with a string -> only user email counted; logs handled", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    (EmailService.sendDemotionNotificationToUser as any).mockResolvedValue(
      true
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Reject with plain string to hit error?.message || error fallback in admin fetch catch
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockRejectedValue("db down");

    // Stub message creators to avoid DB
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-admin" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uSTRD2",
        firstName: "De",
        lastName: "Motion",
        email: "de.motion2@example.com",
        oldRole: "Leader",
        newRole: "Member",
      } as any,
      changedBy: {
        _id: "sysSTRD2",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: false,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1);
    expect(res.messagesCreated).toBe(2);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("@Cloud removed: getAdminUsers rejects with a string in email phase; admin message still created", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Email phase: reject with plain string to hit error?.message || error fallback
    (EmailRecipientUtils.getAdminUsers as any).mockRejectedValueOnce(
      "db offline"
    );
    // Message creation phase: resolve admins and provide IDs
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValueOnce([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "966666666666666666666666" } },
        ]),
    });

    vi.spyOn(
      UnifiedMessageController,
      "createTargetedSystemMessage"
    ).mockResolvedValue({ _id: "msg-admins" } as any);

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "uSTRAC1",
          firstName: "Cloud",
          lastName: "User",
          email: "cloud.user@example.com",
          previousRoleInAtCloud: "Coordinator",
        } as any,
        changeType: "removed",
        systemUser: {
          _id: "sysSTRAC",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin@example.com",
          role: "Super Admin",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(0); // email phase failed entirely
    expect(res.messagesCreated).toBe(1); // admin message created in second phase
  });

  it("@Cloud assigned: no admin recipients -> emailsSent 0 and messagesCreated 0 (early return)", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const UserModule = await import("../../../../src/models/User");

    // No admins discovered for email-sending phase
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([]);
    // Message creation phase: User.find().select() returns [] so early return
    (UserModule.default.find as any).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    });

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "uNONE",
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
          role: "Administrator",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(0);
    expect(res.messagesCreated).toBe(0);
  });

  it("@Cloud removed: mixed email results (true/false) and message creation early-returns -> emailsSent counts only true; messagesCreated 0", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const UserModule = await import("../../../../src/models/User");

    // Two admins discovered
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
      { email: "a2@example.com", firstName: "B", lastName: "Two" },
    ]);
    // Email sending: one true, one false -> should count only the true
    (EmailService.sendAtCloudRoleRemovedToAdmins as any)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    // Message creation phase early-return via no admin IDs
    (UserModule.default.find as any).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    });

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "uREM",
          firstName: "Cloud",
          lastName: "User",
          email: "cloud.user@example.com",
          previousRoleInAtCloud: "Coordinator",
        } as any,
        changeType: "removed",
        systemUser: {
          _id: "sys2",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin@example.com",
          role: "Administrator",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only the fulfilled true counts
    expect(res.messagesCreated).toBe(0);
  });

  it("promotion: two admins where one rejects (timeout/error) -> counts user + one admin only", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    // User promotion email succeeds
    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    // Two admin recipients for role-change flow
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
      { email: "a2@example.com", firstName: "B", lastName: "Two" },
    ]);
    // First admin resolves true, second rejects -> should count only fulfilled true
    (EmailService.sendPromotionNotificationToAdmins as any)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("timeout"));

    // Ensure user message created, and skip admin message creation via empty admin users
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([]);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: { ...userData, oldRole: "Member", newRole: "Leader" },
      changedBy,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(2); // user + one admin
    expect(res.messagesCreated).toBe(1); // only user message
  });

  it("@Cloud assigned: one admin email throws (inner catch) and one succeeds -> emailsSent 1; messagesCreated 1", async () => {
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
    // Email sending: first resolves, second throws to hit inner catch return false
    (EmailService.sendAtCloudRoleAssignedToAdmins as any)
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(() => Promise.reject(new Error("svc down")));

    // Provide admin IDs so admin message creation succeeds (messagesCreated++)
    (UserModule.default.find as any).mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { _id: "a1", email: "a1@example.com", firstName: "A", lastName: "One" },
        { _id: "a2", email: "a2@example.com", firstName: "B", lastName: "Two" },
      ]),
    });

    // Stub unified message creation to avoid any external side-effects or DB work
    vi.spyOn(
      UnifiedMessageController,
      "createTargetedSystemMessage"
    ).mockResolvedValue({ _id: "msg-admins" } as any);

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "uASSN1",
          firstName: "Cloud",
          lastName: "User",
          email: "cloud.user@example.com",
          roleInAtCloud: "Coordinator",
        } as any,
        changeType: "assigned",
        systemUser: {
          _id: "sys3",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin@example.com",
          role: "Administrator",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only one admin success counted
    expect(res.messagesCreated).toBe(1); // admin message created
  });

  it("@Cloud removed: both admin emails succeed and admin message created with previous role included", async () => {
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
    // Both removed emails succeed
    (EmailService.sendAtCloudRoleRemovedToAdmins as any)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    // Provide admin IDs so message is created
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "800000000000000000000001" } },
          { _id: { toString: () => "800000000000000000000002" } },
        ]),
    });

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-admins" } as any);

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "uREM2",
          firstName: "Cloud",
          lastName: "User",
          email: "cloud.user@example.com",
          previousRoleInAtCloud: "Coordinator",
        } as any,
        changeType: "removed",
        systemUser: {
          _id: "sys4",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin@example.com",
          role: "Administrator",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(2);
    expect(res.messagesCreated).toBe(1);
    // Verify content passed includes previous role label
    const args = (spy as any).mock.calls[0][0];
    expect(args.content).toContain("Previous role:");
  });

  it("promotion: user email rejects with a string (non-Error) -> inner catch uses fallback and flow continues", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    // Reject with a plain string to exercise `error?.message || error` fallback
    (EmailService.sendPromotionNotificationToUser as any).mockRejectedValue(
      "smtp unavailable"
    );
    // No admin recipients to keep this focused on the user path
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // Stub message creators to avoid DB and ensure messagesCreated counts
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-admin" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uSTR1",
        firstName: "Pro",
        lastName: "User",
        email: "pro.user@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "sysSTR",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(0);
    expect(res.messagesCreated).toBe(2);
  });

  it("promotion: admin recipients fetch rejects with a string -> only user email counted; logs handled", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Reject with a plain string to exercise `error?.message || error` fallback in catch
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockRejectedValue("db down");

    // Stub message creation helpers
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-admin" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uSTR2",
        firstName: "Pro",
        lastName: "User",
        email: "pro.user2@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "sysSTR2",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1);
    expect(res.messagesCreated).toBe(2);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("user message author.id falls back to 'system' when changedBy._id missing", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Make emails trivial: user email true, no admin recipients
    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-user" } as any);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uAUTH1",
        firstName: "Pro",
        lastName: "User",
        email: "pro.user3@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        // Intentionally omit _id to hit fallback in author mapping
        firstName: "Sys",
        lastName: "Admin",
        email: "admin3@example.com",
        role: "Administrator",
      } as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1);
    expect(res.messagesCreated).toBe(1);

    // Verify fallback author.id was used in createUserRoleChangeMessage
    expect(spy).toHaveBeenCalledTimes(1);
    const args = (spy as any).mock.calls[0];
    const author = args[2];
    expect(author.id).toBe("system");
  });

  it("promotion: user email rejects (inner catch) -> emailsSent 0; messagesCreated 2", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    // Force user email to reject (not timeout) to exercise inner catch
    (EmailService.sendPromotionNotificationToUser as any).mockRejectedValue(
      new Error("smtp fail")
    );
    // No admins for promotion email-sending phase
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // Stub message creation helpers to succeed and avoid DB paths
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-admin" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uPU1",
        firstName: "Pro",
        lastName: "User",
        email: "pro.user@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "sysPU",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(0); // user rejected, no admins
    expect(res.messagesCreated).toBe(2);
  });

  it("promotion: admin recipients fetch throws (outer catch) -> only user email counted; logs", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Throw when fetching admin recipients for promotion phase
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockRejectedValue(new Error("DB down"));

    // Stub message creators to succeed
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-user" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue({ _id: "m-admin" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uPA1",
        firstName: "Pro",
        lastName: " Admin",
        email: "pro.admin@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "sysPA",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email counted
    expect(res.messagesCreated).toBe(2);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("@Cloud assigned: author mapping includes username, avatar, gender provided, role/authLevel", async () => {
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

    // One admin discovered
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    // Assigned email succeeds
    (EmailService.sendAtCloudRoleAssignedToAdmins as any).mockResolvedValue(
      true
    );
    // Provide admin ID so message is created
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "922222222222222222222222" } },
        ]),
    });

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-admins" } as any);

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "uAM1",
          firstName: "Cloud",
          lastName: "Assign",
          email: "cloud.assign@example.com",
          roleInAtCloud: "Coordinator",
        } as any,
        changeType: "assigned",
        systemUser: {
          _id: "sysAM",
          firstName: "Sys",
          lastName: "Avatar",
          email: "avatar.user@example.com",
          role: "Super Admin",
          avatar: "https://cdn/avatar.png",
          gender: "nonbinary",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1);
    expect(res.messagesCreated).toBe(1);

    // Validate author fields mapping
    expect(spy).toHaveBeenCalledTimes(1);
    const args = (spy as any).mock.calls[0];
    const author = args[2];
    expect(author.id).toBe("sysAM");
    expect(author.username).toBe("avatar.user");
    expect(author.avatar).toBe("https://cdn/avatar.png");
    expect(author.gender).toBe("nonbinary");
    expect(author.roleInAtCloud).toBe("Super Admin");
    expect(author.authLevel).toBe("Super Admin");
  });

  it("demotion: user message content omits Context when reason is absent", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // User email succeeds; no admin emails
    (EmailService.sendDemotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);
    // Admin message path early-returns
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([]);

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-user" } as any);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uNR1",
        firstName: "No",
        lastName: "Reason",
        email: "no.reason@example.com",
        oldRole: "Leader",
        newRole: "Member",
      } as any,
      changedBy: {
        _id: "sysNR",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: false,
      // reason intentionally omitted
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1);
    expect(res.messagesCreated).toBe(1);

    // Assert the user message content omits the Context block
    const args = (spy as any).mock.calls[0][0];
    expect(args.content).not.toContain("Context:");
  });

  it("demotion: admin message content omits Reason when reason is absent", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Ensure admin message creation path has admin IDs
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "900000000000000000000001" } },
        ]),
    });

    // Avoid user message path interfering with spy by stubbing it
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "msg-user" });

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-admin" } as any);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uNR2",
        firstName: "No",
        lastName: "Reason",
        email: "no.reason2@example.com",
        oldRole: "Leader",
        newRole: "Member",
      } as any,
      changedBy: {
        _id: "sysNR2",
        firstName: "Sys",
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: false,
      // reason intentionally omitted
    });

    expect(res.success).toBe(true);
    // messagesCreated includes stubbed user message + admin message
    expect(res.messagesCreated).toBe(2);

    // For admin message call, verify content has no Reason suffix
    const adminArgs = (spy as any).mock.calls[0][0];
    expect(adminArgs.content).not.toContain("Reason:");
  });

  it("@Cloud assigned: createTargetedSystemMessage throws -> emailsSent counted, messagesCreated 0 (catch path)", async () => {
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

    // One admin discovered for email + message creation
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
          { _id: { toString: () => "911111111111111111111111" } },
        ]),
    });

    // Force the unified message creation to throw inside createAtCloudRoleChangeAdminMessage
    vi.spyOn(
      UnifiedMessageController,
      "createTargetedSystemMessage"
    ).mockImplementation(() => {
      throw new Error("unified message create fail");
    });

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "uAS1",
          firstName: "Cloud",
          lastName: "Assign",
          email: "cloud.assign@example.com",
          roleInAtCloud: "Coordinator",
        } as any,
        changeType: "assigned",
        systemUser: {
          _id: "sysAS",
          firstName: "Sys",
          lastName: "Admin",
          email: "admin@example.com",
          role: "Super Admin",
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1);
    expect(res.messagesCreated).toBe(0);
  });

  it("@Cloud signup: admin message content and author mapping (username, gender fallback, role/authLevel)", async () => {
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

    // Discover one admin, email succeeds (not strictly required, but keeps emailsSent > 0)
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    (EmailService.sendNewAtCloudLeaderSignupToAdmins as any).mockResolvedValue(
      true
    );

    // Provide an admin user id so message creation proceeds
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "977777777777777777777771" } },
        ]),
    });

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-admin" } as any);

    const res =
      await AutoEmailNotificationService.sendAtCloudRoleChangeNotification({
        userData: {
          _id: "uS1",
          firstName: "Cloud",
          lastName: " Sign",
          email: "cloud.sign@example.com",
          roleInAtCloud: "Coordinator",
        } as any,
        changeType: "signup",
        systemUser: {
          _id: "sysSU",
          firstName: "Sys",
          lastName: " Admin",
          email: "sys.admin@example.com",
          role: "Super Admin",
          // omit gender to exercise fallback to 'male'
        } as any,
      });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1);
    expect(res.messagesCreated).toBe(1);

    // Validate content and author mapping
    expect(spy).toHaveBeenCalledTimes(1);
    const [payload, targets, author] = (spy as any).mock.calls[0];
    expect(targets).toContain("977777777777777777777771");
    expect(payload.title).toContain("New @Cloud Leader Signup");
    expect(payload.content).toContain("has signed up as an @Cloud Leader");
    expect(payload.content).toContain("Coordinator");

    expect(author).toMatchObject({
      id: "sysSU",
      username: "sys.admin",
      gender: "male", // fallback used
      roleInAtCloud: "Super Admin",
      authLevel: "Super Admin",
    });
  });

  it("promotion: admin message content includes Reason when reason is provided", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Keep email phase simple: user email true; no admin emails in email-sending phase
    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // Admin message creation path: provide one admin ID
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "966666666666666666666661" } },
        ]),
    });

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-admin" } as any);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uPROMR1",
        firstName: "Pro",
        lastName: "User",
        email: "pro.user6@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "cbR1",
        firstName: "Sec",
        lastName: " Admin",
        email: "sec.admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: true,
      reason: "policy alignment",
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email
    expect(res.messagesCreated).toBe(2); // user + admin message

    // Verify admin message content contains Reason suffix
    const adminArgs = (spy as any).mock.calls.find(
      (c: any[]) =>
        Array.isArray(c[1]) && c[1].includes("966666666666666666666661")
    )[0];
    expect(adminArgs.content).toContain("Reason: policy alignment");
  });

  it("demotion: admin message content includes Reason when reason is provided", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Keep email phase simple: user email true; no admin emails in email-sending phase
    (EmailService.sendDemotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // Admin message creation path: provide one admin ID
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "977777777777777777777772" } },
        ]),
    });

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-admin" } as any);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uDEMOR1",
        firstName: "De",
        lastName: "Motion",
        email: "de.motion6@example.com",
        oldRole: "Leader",
        newRole: "Member",
      } as any,
      changedBy: {
        _id: "cbRD1",
        firstName: "Sec",
        lastName: " Admin",
        email: "sec.admin@example.com",
        role: "Administrator",
      } as any,
      isPromotion: false,
      reason: "policy breach",
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email
    expect(res.messagesCreated).toBe(2); // user + admin message

    // Verify admin message content contains Reason suffix
    const adminArgs = (spy as any).mock.calls.find(
      (c: any[]) =>
        Array.isArray(c[1]) && c[1].includes("977777777777777777777772")
    )[0];
    expect(adminArgs.content).toContain("Reason: policy breach");
  });

  it("promotion: user message author mapping includes username, avatar, provided gender and role/authLevel", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // User email succeeds; no admin recipients for email-sending phase
    (EmailService.sendPromotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);
    // Ensure admin message path early-returns to avoid second controller call
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([]);

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-user" } as any);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uAUTHMAP1",
        firstName: "Pro",
        lastName: "User",
        email: "pro.user4@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "cb1",
        firstName: "Admin",
        lastName: " User",
        email: "admin.user@example.com",
        role: "Administrator",
        avatar: "https://cdn/avatar-admin.png",
        gender: "nonbinary",
      } as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1);
    expect(res.messagesCreated).toBe(1);

    // Validate author fields for the user message
    expect(spy).toHaveBeenCalledTimes(1);
    const args = (spy as any).mock.calls[0];
    const author = args[2];
    expect(author).toMatchObject({
      id: "cb1",
      firstName: "Admin",
      lastName: " User",
      username: "admin.user",
      avatar: "https://cdn/avatar-admin.png",
      gender: "nonbinary",
      roleInAtCloud: "Administrator",
      authLevel: "Administrator",
    });
  });

  it("promotion: admin message author mapping uses username, avatar, gender fallback 'male', role/authLevel from changedBy", async () => {
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );
    const UserModule = await import("../../../../src/models/User");
    const { UnifiedMessageController } = await import(
      "../../../../src/controllers/unifiedMessageController"
    );

    // Skip admin emails in sendRoleChangeNotification phase
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // Provide one admin for admin message creation path
    (EmailRecipientUtils.getAdminUsers as any).mockResolvedValue([
      { email: "a1@example.com", firstName: "A", lastName: "One" },
    ]);
    (UserModule.default.find as any).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: { toString: () => "955555555555555555555551" } },
        ]),
    });

    // Let user message creation succeed without interfering
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "msg-user" });

    const spy = vi
      .spyOn(UnifiedMessageController, "createTargetedSystemMessage")
      .mockResolvedValue({ _id: "msg-admin" } as any);

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: {
        _id: "uAUTHMAP2",
        firstName: "Pro",
        lastName: "User",
        email: "pro.user5@example.com",
        oldRole: "Member",
        newRole: "Leader",
      } as any,
      changedBy: {
        _id: "cb2",
        firstName: "Sec",
        lastName: " Admin",
        email: "sec.admin@example.com",
        role: "Administrator",
        avatar: "https://cdn/avatar-secadmin.png",
        // gender intentionally omitted to exercise fallback to 'male'
      } as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    // messagesCreated includes stubbed user + admin
    expect(res.messagesCreated).toBe(2);

    // Identify the admin message call by its target IDs array
    const calls = (spy as any).mock.calls as any[];
    // Find the call whose targets contain our admin ID
    const adminCall = calls.find(
      (c) => Array.isArray(c[1]) && c[1].includes("955555555555555555555551")
    );
    expect(adminCall).toBeTruthy();
    const adminAuthor = adminCall[2];
    expect(adminAuthor).toMatchObject({
      id: "cb2",
      firstName: "Sec",
      lastName: " Admin",
      username: "sec.admin",
      avatar: "https://cdn/avatar-secadmin.png",
      gender: "male", // fallback
      roleInAtCloud: "Administrator",
      authLevel: "Administrator",
    });
  });
});
