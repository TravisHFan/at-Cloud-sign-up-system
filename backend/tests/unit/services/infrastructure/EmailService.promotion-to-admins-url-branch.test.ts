import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendPromotionNotificationToAdmins FRONTEND_URL branches", () => {
  let spy: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService as any, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  const adminEmail = "admin@example.com";
  const adminName = "Admin";
  const changedBy = {
    firstName: "Ops",
    lastName: "One",
    role: "Administrator",
  } as any;
  const user = {
    firstName: "User",
    lastName: "X",
    email: "u@example.com",
    oldRole: "Participant",
    newRole: "Leader",
  } as any;

  it("uses default localhost when FRONTEND_URL is not set (promotion to admins)", async () => {
    delete process.env.FRONTEND_URL;
    const ok = await (EmailService as any).sendPromotionNotificationToAdmins(
      adminEmail,
      adminName,
      user,
      changedBy
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("http://localhost:5173/admin/users");
    expect(String(args.text)).toContain("http://localhost:5173/admin/users");
  });

  it("uses custom FRONTEND_URL when set (promotion to admins)", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const ok = await (EmailService as any).sendPromotionNotificationToAdmins(
      adminEmail,
      adminName,
      user,
      changedBy
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("https://app.example.com/admin/users");
    expect(String(args.text)).toContain("https://app.example.com/admin/users");
  });
});
