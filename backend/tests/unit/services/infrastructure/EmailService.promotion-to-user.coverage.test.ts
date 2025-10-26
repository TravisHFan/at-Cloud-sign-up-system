import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendPromotionNotificationToUser - coverage edges", () => {
  const baseUser = {
    firstName: "Sam",
    lastName: "Lee",
    email: "sam@example.com",
    oldRole: "Participant",
    newRole: "Leader",
  } as any;
  const admin = {
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com",
    role: "Administrator",
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

  it("uses Leader icon and content for promotion to Leader", async () => {
    const ok = await EmailService.sendPromotionNotificationToUser(
      baseUser.email,
      { ...baseUser, newRole: "Leader" },
      admin
    );

    expect(ok).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const args = (sendSpy as any).mock.calls[0][0];
    expect(args.subject).toMatch(/Congratulations|Promotion/i);
    expect(args.html).toContain("🌟"); // Leader icon
    expect(args.html).toContain("role-change");
  });

  it("falls back to default content and icon for unknown role", async () => {
    const ok = await EmailService.sendPromotionNotificationToUser(
      baseUser.email,
      { ...baseUser, newRole: "Some Unknown" },
      admin
    );

    expect(ok).toBe(true);
    const args = (sendSpy as any).mock.calls[0][0];
    expect(args.html).toContain("✨"); // default icon
    expect(args.html).toContain("promotion-card");
  });

  it("uses Administrator icon and content for promotion to Administrator", async () => {
    const ok = await EmailService.sendPromotionNotificationToUser(
      baseUser.email,
      { ...baseUser, newRole: "Administrator" },
      admin
    );

    expect(ok).toBe(true);
    const args = (sendSpy as any).mock.calls[0][0];
    expect(args.html).toContain("⚡"); // Administrator icon
    expect(args.html).toContain("role-change");
  });
});
