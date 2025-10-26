import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendDemotionNotificationToAdmins FRONTEND_URL branches", () => {
  let spy: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  const adminEmail = "admin@example.com";
  const adminName = "Admin";
  const changedBy = {
    firstName: "Ops",
    lastName: "Admin",
    email: "ops@example.com",
    role: "Administrator",
  };

  it("uses default localhost URL when FRONTEND_URL not set (admins demotion)", async () => {
    delete process.env.FRONTEND_URL;
    const ok = await EmailService.sendDemotionNotificationToAdmins(
      adminEmail,
      adminName,
      {
        firstName: "Regular",
        lastName: "User",
        email: "regular@example.com",
        oldRole: "Administrator",
        newRole: "Member",
      } as any,
      changedBy,
      "Routine"
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("http://localhost:5173/admin/users");
    expect(String(args.text)).toContain("http://localhost:5173/admin/users");
  });

  it("uses custom FRONTEND_URL when set (admins demotion)", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const ok = await EmailService.sendDemotionNotificationToAdmins(
      adminEmail,
      adminName,
      {
        firstName: "Regular",
        lastName: "User",
        email: "regular@example.com",
        oldRole: "Administrator",
        newRole: "Member",
      } as any,
      changedBy
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("https://app.example.com/admin/users");
    expect(String(args.text)).toContain("https://app.example.com/admin/users");
  });
});
