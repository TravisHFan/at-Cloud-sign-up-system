import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoEmailNotificationService } from "../../../../src/services/infrastructure/autoEmailNotificationService";

vi.mock("../../../../src/services/infrastructure/emailService", () => ({
  EmailService: {
    sendPromotionNotificationToUser: vi.fn(),
    sendPromotionNotificationToAdmins: vi.fn(),
    sendDemotionNotificationToUser: vi.fn(),
    sendDemotionNotificationToAdmins: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/emailRecipientUtils", () => ({
  EmailRecipientUtils: {
    getSystemAuthorizationChangeRecipients: vi.fn(),
    getAdminUsers: vi.fn(),
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
});
