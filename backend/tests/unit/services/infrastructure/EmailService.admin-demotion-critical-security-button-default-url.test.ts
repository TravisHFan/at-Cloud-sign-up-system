import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

// Targets the exact Security Review anchor text line and default URL path
// for the Critical impact branch in the admin demotion template.
describe("EmailService.sendDemotionNotificationToAdmins - critical security button (default URL)", () => {
  const OLD_ENV = { ...process.env };
  let spy: any;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.FRONTEND_URL; // force default localhost URL
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    vi.restoreAllMocks();
  });

  it("renders Security Review button with default URL for Super Admin demotion", async () => {
    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "alerts@example.com",
      "Alerts",
      {
        _id: "u4",
        firstName: "Sam",
        lastName: "Root",
        email: "sam@example.com",
        oldRole: "Super Admin",
        newRole: "Leader", // Critical impact
      } as any,
      {
        firstName: "Alice",
        lastName: "Ops",
        email: "alice@example.com",
        role: "Administrator",
      },
      undefined
    );

    expect(ok).toBe(true);

    const call = spy.mock.calls[0][0] as any;
    const html = String(call.html);

    expect(html).toContain(
      'href="http://localhost:5173/admin/security-review"'
    );
    expect(html).toMatch(/>\s*Security Review\s*</);
  });
});
