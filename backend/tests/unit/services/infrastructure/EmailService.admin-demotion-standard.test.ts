import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// This covers the admin demotion notification path where impact resolves to Standard (e.g., Leader -> Administrator)
// Ensures no Security Review link is included and key admin buttons exist.
describe("EmailService.sendDemotionNotificationToAdmins - Standard impact (no security review)", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;
  let sentArgs: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
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

  it("renders Standard Impact and omits Security Review for Leader -> Administrator", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-admin-low" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await (EmailService as any).sendDemotionNotificationToAdmins(
      "admin@example.com",
      "Alice Admin",
      {
        _id: "user-2",
        firstName: "Ben",
        lastName: "Lee",
        email: "ben.lee@example.com",
        oldRole: "Leader",
        newRole: "Administrator", // yields Low in inner function -> switch default => Standard
      },
      {
        firstName: "Carol",
        lastName: "Ops",
        email: "carol.ops@example.com",
        role: "Administrator",
      },
      undefined
    );

    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalled();
    expect(String(sentArgs?.html)).toContain("Standard Impact");
    expect(String(sentArgs?.html)).not.toContain("/admin/security-review");
    // Buttons present for profile and audit log
    expect(String(sentArgs?.html)).toContain(
      "/admin/users/ben.lee@example.com"
    );
    expect(String(sentArgs?.html)).toContain("/admin/audit-log");
  });
});
