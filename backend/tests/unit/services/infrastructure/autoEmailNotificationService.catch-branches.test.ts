import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import { AutoEmailNotificationService } from "../../../../src/services/infrastructure/autoEmailNotificationService";

// We’ll stub EmailService and EmailRecipientUtils functions at call sites.
vi.mock("../../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendPromotionNotificationToUser: vi.fn(),
    sendPromotionNotificationToAdmins: vi.fn(),
    sendDemotionNotificationToUser: vi.fn(),
    sendDemotionNotificationToAdmins: vi.fn(),
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

describe("AutoEmailNotificationService catch branches", () => {
  const baseUser = {
    _id: "507f1f77bcf86cd799439011",
    firstName: "Test",
    lastName: "User",
    email: "user@example.com",
    roleInAtCloud: "Area Leader",
    previousRoleInAtCloud: "Area Leader",
  };
  const admin = {
    firstName: "A",
    lastName: "B",
    email: "admin@example.com",
    role: "Administrator",
  };

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles admin promotion email failures (inner catch) and still returns success with messagesCreated when messages succeed", async () => {
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
    // Admin recipients throw inside try to hit catch
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockRejectedValue(new Error("DB fail"));

    // Stub unified messages to succeed via spies on private methods using any-cast
    const userMsgSpy = vi
      .spyOn(AutoEmailNotificationService as any, "createUserRoleChangeMessage")
      .mockResolvedValue({ _id: "m1" });
    const adminMsgSpy = vi
      .spyOn(
        AutoEmailNotificationService as any,
        "createAdminRoleChangeMessage"
      )
      .mockResolvedValue({ _id: "m2" });

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      userData: baseUser as any,
      changedBy: admin as any,
      isPromotion: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailsSent).toBe(1); // only user email succeeded
    expect(res.messagesCreated).toBe(2); // both messages succeeded
    expect(userMsgSpy).toHaveBeenCalled();
    expect(adminMsgSpy).toHaveBeenCalled();
  });

  it("outer catch: returns success:false when unexpected error thrown", async () => {
    const { EmailService } = await import(
      "../../../../src/services/infrastructure/emailService"
    );
    const { EmailRecipientUtils } = await import(
      "../../../../src/utils/emailRecipientUtils"
    );

    // Ensure Promise.race settles immediately by resolving primary promises
    (EmailService.sendDemotionNotificationToUser as any).mockResolvedValue(
      true
    );
    (EmailService.sendDemotionNotificationToAdmins as any).mockResolvedValue(
      true
    );
    (
      EmailRecipientUtils.getSystemAuthorizationChangeRecipients as any
    ).mockResolvedValue([]);

    // Force an unexpected rejection from message creation (outside inner try/catches)
    const userMsgThrow = vi
      .spyOn(AutoEmailNotificationService as any, "createUserRoleChangeMessage")
      .mockRejectedValue(new Error("boom"));

    const result =
      await AutoEmailNotificationService.sendRoleChangeNotification({
        userData: baseUser as any,
        changedBy: admin as any,
        isPromotion: false,
        reason: "policy",
      });

    expect(userMsgThrow).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.emailsSent).toBe(0);
    expect(result.messagesCreated).toBe(0);
  });
});
