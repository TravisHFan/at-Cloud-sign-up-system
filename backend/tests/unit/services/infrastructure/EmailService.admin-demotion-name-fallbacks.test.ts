import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// Covers the name fallback branches (firstName/lastName may be missing)
// in sendDemotionNotificationToAdmins to close uncovered logical || paths.
describe("EmailService.sendDemotionNotificationToAdmins - name fallbacks", () => {
  let spy: any;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats demoted user and admin names without undefined/extra spaces when names missing", async () => {
    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "ops.admins@example.com",
      "Ops Admins",
      {
        _id: "u1",
        firstName: "", // trigger fallback
        lastName: "Solo", // only last name provided
        email: "solo@example.com",
        oldRole: "Administrator",
        newRole: "Leader", // Medium impact (non-critical)
      } as any,
      {
        firstName: "Ava",
        lastName: "", // trigger fallback on admin last name
        email: "ava.admin@example.com",
        role: "Administrator",
      },
      undefined // no reason provided
    );

    expect(ok).toBe(true);
    const call = spy.mock.calls[0][0] as any;
    const html = String(call.html);

    // No 'undefined' should appear due to fallbacks
    expect(html).not.toContain("undefined");

    // Affected user should render with just last name when first name missing
    expect(html).toMatch(/Affected User:<\/strong>\s*Solo/);

    // Processed By should render with just first name when last name missing
    expect(html).toMatch(/Processed By:<\/strong>\s*Ava/);

    // Medium impact path should not include the Security Review button
    expect(html).not.toContain("Security Review");
  });
});
