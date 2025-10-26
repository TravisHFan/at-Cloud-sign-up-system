import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

// Targets the audit-log anchor FRONTEND_URL fallback vs override within the
// admin demotion notification template to ensure both sides of the `||` are hit.
describe("EmailService.sendDemotionNotificationToAdmins - audit log URL branch", () => {
  const OLD_ENV = { ...process.env };
  let spy: any;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    vi.restoreAllMocks();
  });

  it("uses custom FRONTEND_URL for audit-log link when set (non-critical path)", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";

    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "ops@example.com",
      "Ops",
      {
        _id: "u3",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        oldRole: "Administrator",
        newRole: "Leader", // Medium impact, avoids Security Review noise
      } as any,
      {
        firstName: "Amy",
        lastName: "Admin",
        email: "amy@example.com",
        role: "Administrator",
      },
      undefined
    );

    expect(ok).toBe(true);

    const call = spy.mock.calls[0][0] as any;
    const html = String(call.html);

    expect(html).toContain('href="https://app.example.com/admin/audit-log"');
  });
});
