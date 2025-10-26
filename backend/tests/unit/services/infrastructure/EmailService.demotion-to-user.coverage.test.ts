import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendDemotionNotificationToUser - coverage edges", () => {
  const baseUser = {
    firstName: "Alex",
    lastName: "Doe",
    email: "alex@example.com",
    oldRole: "Leader",
    newRole: "Participant",
  } as any;
  const admin = {
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com",
    role: "Super Admin",
  } as any;

  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sendSpy = vi
      .spyOn(EmailService as any, "sendEmail")
      .mockResolvedValue(true as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes participant guidance, icon, and reason section when reason provided", async () => {
    const reason = "Team realignment";
    const user = { ...baseUser, newRole: "Participant" };

    const ok = await EmailService.sendDemotionNotificationToUser(
      user.email,
      user,
      admin,
      reason
    );

    expect(ok).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const args = (sendSpy as any).mock.calls[0][0];
    expect(args.subject).toContain("Ministry Role Update");
    expect(args.html).toContain("🤝");
    expect(args.html).toContain("reason-section");
    expect(args.html).toContain("#6c757d");
  });

  it("uses administrator color theme when newRole is Administrator and no reason provided", async () => {
    const user = { ...baseUser, newRole: "Administrator" };

    const ok = await EmailService.sendDemotionNotificationToUser(
      user.email,
      user,
      admin
    );

    expect(ok).toBe(true);
    const args = (sendSpy as any).mock.calls[0][0];
    expect(args.html).toContain("#17a2b8");
    expect(args.html).toContain("new-role");
  });
});
