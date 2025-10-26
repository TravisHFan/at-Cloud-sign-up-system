import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService sendAtCloudRoleChangeToAdmins FRONTEND_URL branches", () => {
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

  it("uses default localhost URL when FRONTEND_URL is not set (to admins)", async () => {
    delete process.env.FRONTEND_URL;
    const ok = await EmailService.sendAtCloudRoleChangeToAdmins(
      "admin@example.com",
      "Admin A",
      {
        _id: "1",
        firstName: "User",
        lastName: "One",
        email: "user.one@example.com",
        oldRoleInAtCloud: "Member",
        newRoleInAtCloud: "Leader",
      } as any
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("http://localhost:5173/admin/users");
    expect(String(args.text)).toContain("Please review in admin dashboard");
  });

  it("uses custom FRONTEND_URL when set (to admins)", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const ok = await EmailService.sendAtCloudRoleChangeToAdmins(
      "admin@example.com",
      "Admin A",
      {
        _id: "2",
        firstName: "User",
        lastName: "Two",
        email: "user.two@example.com",
        oldRoleInAtCloud: "Leader",
        newRoleInAtCloud: "Member",
      } as any
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("https://app.example.com/admin/users");
  });
});
