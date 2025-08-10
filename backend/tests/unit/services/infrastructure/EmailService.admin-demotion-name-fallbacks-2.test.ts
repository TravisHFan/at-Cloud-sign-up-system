import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// Complements the first name-fallback test by flipping which fields are missing
// to cover the remaining logical (|| "") branches in the admin demotion template.
describe("EmailService.sendDemotionNotificationToAdmins - name fallbacks (complement)", () => {
  let spy: any;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders clean names when user's lastName missing and admin's firstName missing", async () => {
    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "ops.admins@example.com",
      "Ops Admins",
      {
        _id: "u2",
        firstName: "Solo", // only first name provided
        lastName: "", // trigger fallback on user last name
        email: "solo@example.com",
        oldRole: "Administrator",
        newRole: "Leader", // Medium impact
      } as any,
      {
        firstName: "", // trigger fallback on admin first name
        lastName: "Admin",
        email: "admin@example.com",
        role: "Administrator",
      },
      undefined
    );

    expect(ok).toBe(true);

    const call = spy.mock.calls[0][0] as any;
    const html = String(call.html);

    // No 'undefined' should appear due to fallbacks
    expect(html).not.toContain("undefined");

    // Affected user should render with just first name when last name missing
    expect(html).toMatch(/Affected User:<\/strong>\s*Solo/);

    // Processed By should render with just last name when first name missing
    expect(html).toMatch(/Processed By:<\/strong>\s*Admin/);

    // Medium impact path should not include the Security Review button
    expect(html).not.toContain("Security Review");
  });
});
