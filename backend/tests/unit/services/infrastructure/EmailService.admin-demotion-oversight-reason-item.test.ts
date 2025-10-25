import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService.sendDemotionNotificationToAdmins - oversight reason list item toggle", () => {
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

  it("renders the communication oversight list item when reason is provided (non-critical path)", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-admin-reason" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await (EmailService as any).sendDemotionNotificationToAdmins(
      "alerts@example.com",
      "Admin Jane",
      {
        _id: "u-xyz",
        firstName: "Tom",
        lastName: "Ray",
        email: "tom.ray@example.com",
        oldRole: "Administrator",
        newRole: "Leader", // Medium impact (non-critical)
      },
      {
        firstName: "Grace",
        lastName: "Ops",
        email: "ops@example.com",
        role: "Super Admin",
      },
      "Performance concerns"
    );

    expect(ok).toBe(true);
    const html = String(sentArgs?.html);
    // Communication item appears only when reason is present
    expect(html).toContain(
      "<li><strong>Communication:</strong> Ensure user has received appropriate guidance</li>"
    );
    // No security review button for Medium impact
    expect(html).not.toContain("/admin/security-review");
  });
});
