import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// Covers High impact branch (Administrator -> Participant)
// Ensures action/description reflect High and that Security Review link is not rendered
describe("EmailService.sendDemotionNotificationToAdmins - High impact branch", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;
  let sentArgs: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    delete (process.env as any).FRONTEND_URL; // force default URL branch in admin links
    process.env.NODE_ENV = "development";
    (EmailService as any).transporter = null;
    sentArgs = undefined;
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    (EmailService as any).transporter = null;
    vi.restoreAllMocks();
  });

  it("renders High impact details and omits Security Review button", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-admin-high" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "alerts@example.com",
      "Ops Team",
      {
        _id: "u-3",
        firstName: "Alex",
        lastName: "Admin",
        email: "alex.admin@example.com",
        oldRole: "Administrator",
        newRole: "Participant", // High impact per mapping
      },
      {
        firstName: "Grace",
        lastName: "Ops",
        email: "ops@example.com",
        role: "Administrator",
      },
      "policy enforcement"
    );

    expect(ok).toBe(true);
    const html = String(sentArgs?.html);
    expect(html).toContain(
      "Significant privilege reduction from administrative level"
    );
    expect(html).toContain(
      "Monitor user access patterns, review administrative changes, consider transition support"
    );
    expect(html).not.toContain("/admin/security-review");
    // Default URL branch for admin links
    expect(html).toContain(
      "http://localhost:5173/admin/users/alex.admin@example.com"
    );
    expect(html).toContain("http://localhost:5173/admin/audit-log");
  });
});
