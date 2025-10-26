import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService sendAtCloudRoleAssignedToAdmins FRONTEND_URL branches", () => {
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

  it("uses default localhost URL when FRONTEND_URL is not set (role assigned)", async () => {
    delete process.env.FRONTEND_URL;
    const ok = await (EmailService as any).sendAtCloudRoleAssignedToAdmins(
      "admin@example.com",
      "Admin B",
      {
        firstName: "New",
        lastName: "Leader",
        email: "new.leader@example.com",
        roleInAtCloud: "Leader",
      }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("http://localhost:5173/admin/users");
  });

  it("uses custom FRONTEND_URL when set (role assigned)", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const ok = await (EmailService as any).sendAtCloudRoleAssignedToAdmins(
      "admin@example.com",
      "Admin B",
      {
        firstName: "New",
        lastName: "Leader",
        email: "new.leader@example.com",
        roleInAtCloud: "Leader",
      }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("https://app.example.com/admin/users");
  });
});
