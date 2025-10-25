import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// Covers Medium impact branch (Administrator -> Leader OR Leader -> Participant)
// and asserts that Security Review link is not rendered while action copy reflects Medium
describe("EmailService.sendDemotionNotificationToAdmins - Medium impact branch", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;
  let sentArgs: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    process.env.NODE_ENV = "development";
    EmailTransporter.resetTransporter();
    sentArgs = undefined;
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    EmailTransporter.resetTransporter();
    vi.restoreAllMocks();
  });

  it("renders Medium impact details and omits Security Review", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-admin-medium" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "ops@example.com",
      "Ops Admin",
      {
        _id: "u-2",
        firstName: "Tina",
        lastName: "Med",
        email: "tina.med@example.com",
        oldRole: "Administrator",
        newRole: "Leader", // Medium impact per mapping
      },
      {
        firstName: "Gary",
        lastName: "Ops",
        email: "g.ops@example.com",
        role: "Administrator",
      },
      undefined
    );

    expect(ok).toBe(true);
    const html = String(sentArgs?.html);
    expect(html).toContain(
      "Moderate role adjustment within operational levels"
    );
    expect(html).toContain(
      "Update access permissions, notify relevant teams, provide role transition guidance"
    );
    expect(html).not.toContain("/admin/security-review");
  });
});
