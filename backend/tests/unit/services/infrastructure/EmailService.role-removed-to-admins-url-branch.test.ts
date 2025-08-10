import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService sendAtCloudRoleRemovedToAdmins FRONTEND_URL branches", () => {
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

  it("uses custom FRONTEND_URL when set (role removed)", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const ok = await (EmailService as any).sendAtCloudRoleRemovedToAdmins(
      "admin@example.com",
      "Admin B",
      {
        firstName: "User",
        lastName: "Removed",
        email: "removed@example.com",
        previousRoleInAtCloud: "Leader",
      }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("https://app.example.com/admin/users");
  });

  it("uses default localhost URL when FRONTEND_URL is not set (role removed)", async () => {
    delete process.env.FRONTEND_URL;
    const ok = await (EmailService as any).sendAtCloudRoleRemovedToAdmins(
      "admin@example.com",
      "Admin B",
      {
        firstName: "User",
        lastName: "Removed",
        email: "removed@example.com",
        previousRoleInAtCloud: "Leader",
      }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("http://localhost:5173/admin/users");
  });
});
