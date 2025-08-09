import { describe, it, expect, vi, afterEach } from "vitest";
import { AutoEmailNotificationService } from "../../../../src/services/infrastructure/autoEmailNotificationService";
import { EmailService } from "../../../../src/services/infrastructure/emailService";
import { EmailRecipientUtils } from "../../../../src/utils/emailRecipientUtils";
import { UnifiedMessageController } from "../../../../src/controllers/unifiedMessageController";

describe("AutoEmailNotificationService - timeout/race branches", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const changeBase = {
    userData: {
      _id: "507f1f77bcf86cd799439011",
      firstName: "U",
      lastName: "Ser",
      email: "user@example.com",
      oldRole: "Leader",
      newRole: "Participant",
    },
    changedBy: {
      firstName: "A",
      lastName: "Dmin",
      email: "admin@example.com",
      role: "Super Admin",
    },
    reason: "policy",
  } as any;

  it("counts only fulfilled admin emails when some reject (demotion path)", async () => {
    // Prevent real 10s timers from being scheduled by the service's Promise.race timeouts
    const timeoutSpy = vi
      .spyOn(global, "setTimeout" as any)
      // return dummy id, do not schedule a handle
      .mockImplementation(((cb: any, ms?: number) => 0) as any);
    const recipients = [
      { firstName: "Ann", lastName: "One", email: "a1@example.com" },
      { firstName: "Ben", lastName: "Two", email: "b2@example.com" },
    ];
    vi.spyOn(
      EmailRecipientUtils,
      "getSystemAuthorizationChangeRecipients"
    ).mockResolvedValue(recipients as any);

    // Avoid DB and websocket side-effects from unified message creation
    vi.spyOn(
      UnifiedMessageController,
      "createTargetedSystemMessage"
    ).mockResolvedValue({ _id: "msg-1" } as any);
    // Ensure admin message creation path exits early (no admin DB lookup)
    vi.spyOn(EmailRecipientUtils, "getAdminUsers").mockResolvedValue([] as any);
    // Directly stub internal message creators to bypass dynamic import of User model
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createUserRoleChangeMessage"
    ).mockResolvedValue({ _id: "user-msg" });
    vi.spyOn(
      AutoEmailNotificationService as any,
      "createAdminRoleChangeMessage"
    ).mockResolvedValue(null);

    // First admin resolves true, second rejects (simulating timeout path)
    vi.spyOn(EmailService, "sendDemotionNotificationToAdmins")
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("Email timeout"));

    // User demotion email resolves true
    vi.spyOn(EmailService, "sendDemotionNotificationToUser").mockResolvedValue(
      true
    );

    const res = await AutoEmailNotificationService.sendRoleChangeNotification({
      ...changeBase,
      isPromotion: false,
    });

    expect(res.success).toBe(true);
    // 1 user + 1 admin success; second admin rejected
    expect(res.emailsSent).toBe(2);
    // messagesCreated >=1 (two message creators run; we don't assert exact text here)
    expect(res.messagesCreated).toBeGreaterThanOrEqual(1);
    // Ensure no pending timers remain from mocked races
    expect(timeoutSpy).toHaveBeenCalled();
  }, 20000);
});
