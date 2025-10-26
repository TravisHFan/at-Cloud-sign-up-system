import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendNewAtCloudLeaderSignupToAdmins FRONTEND_URL branches (co-worker)", () => {
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

  it("uses default localhost URL when FRONTEND_URL not set (new @Cloud co-worker)", async () => {
    delete process.env.FRONTEND_URL;
    const ok = await (EmailService as any).sendNewAtCloudLeaderSignupToAdmins(
      "admin@example.com",
      "Admin",
      {
        firstName: "New",
        lastName: "Leader",
        email: "nl@example.com",
        roleInAtCloud: "Leader",
      }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("http://localhost:5173/admin/users");
  });

  it("uses custom FRONTEND_URL when set (new @Cloud co-worker)", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const ok = await (EmailService as any).sendNewAtCloudLeaderSignupToAdmins(
      "admin@example.com",
      "Admin",
      {
        firstName: "New",
        lastName: "Leader",
        email: "nl@example.com",
        roleInAtCloud: "Leader",
      }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("https://app.example.com/admin/users");
  });
});
