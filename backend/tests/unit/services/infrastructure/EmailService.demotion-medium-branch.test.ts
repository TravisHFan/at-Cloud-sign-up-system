import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService demotion impact - Medium branch", () => {
  const originalEnv = { ...process.env };
  let spy: any;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("Administrator -> Leader hits Medium impact (no Security Review link)", async () => {
    const ok = await (EmailService as any).sendDemotionNotificationToAdmins(
      "admin@example.com",
      "Admin Name",
      {
        _id: "u1",
        firstName: "User",
        lastName: "Demo",
        email: "user@example.com",
        oldRole: "Administrator",
        newRole: "Leader",
      },
      {
        firstName: "Grace",
        lastName: "Admin",
        email: "grace.admin@example.com",
        role: "Super Admin",
      }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0];
    const html = String(args.html);
    expect(html).toContain(
      "Moderate role adjustment within operational levels"
    );
    expect(html).not.toContain("/admin/security-review");
  });
});
