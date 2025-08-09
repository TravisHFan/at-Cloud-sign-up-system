import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService.sendDemotionNotificationToUser - more branches", () => {
  const baseUser = {
    firstName: "Alex",
    lastName: "Doe",
    email: "alex@example.com",
    oldRole: "Administrator",
    newRole: "Leader",
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

  it("Leader path uses yellow theme and no reason block when undefined", async () => {
    const ok = await EmailService.sendDemotionNotificationToUser(
      baseUser.email,
      { ...baseUser, newRole: "Leader" },
      admin
    );

    expect(ok).toBe(true);
    const args = (sendSpy as any).mock.calls[0][0];
    // leader color from getRoleTransitionGuidance: #ffc107
    expect(args.html).toContain("#ffc107");
    // reason block is not rendered (CSS class exists in <style>, so check the actual div)
    expect(args.html).not.toContain('<div class="reason-section">');
  });

  it("default path uses green theme when newRole is not matched", async () => {
    const ok = await EmailService.sendDemotionNotificationToUser(
      baseUser.email,
      { ...baseUser, newRole: "Unknown" },
      admin
    );

    expect(ok).toBe(true);
    const args = (sendSpy as any).mock.calls[0][0];
    // default color in demotion-to-user branch: #28a745
    expect(args.html).toContain("#28a745");
  });
});
