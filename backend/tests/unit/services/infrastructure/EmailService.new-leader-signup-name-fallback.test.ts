import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendNewLeaderSignupEmail name fallback and links", () => {
  let spy: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
    process.env.FRONTEND_URL = "https://admin.example.org";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("formats leaderName without undefined when first/last missing and includes admin links placeholder", async () => {
    const ok = await EmailService.sendNewLeaderSignupEmail(
      "admin@example.org",
      "Admin C",
      {
        firstName: "",
        lastName: "",
        email: "new@example.org",
        roleInAtCloud: "Leader",
        signupDate: "2025-08-10",
      }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    const html = String(args.html);
    expect(html).toContain("<strong>Name:</strong> ");
    expect(html).not.toMatch(/undefined|\s{2,}<\/strong>/);
    expect(args.subject).toMatch(/New Leader Signup:.* - Leader/);
    // Links use ADMIN_DASHBOARD_URL placeholder in HTML; ensure placeholders exist to cover branch
    expect(html).toContain("#{ADMIN_DASHBOARD_URL}/leaders");
    expect(html).toContain("#{ADMIN_DASHBOARD_URL}/users");
  });
});
