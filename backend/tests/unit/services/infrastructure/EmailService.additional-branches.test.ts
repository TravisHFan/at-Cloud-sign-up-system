import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// Minimal helper to reset cached transporter
const resetTransporter = () => ((EmailService as any).transporter = null);

describe("EmailService additional branch coverage", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;
  let sentArgs: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    resetTransporter();
    sentArgs = undefined;
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    resetTransporter();
    vi.restoreAllMocks();
  });

  it("uses jsonTransport when real creds are placeholders (hasRealCredentials=false)", async () => {
    process.env.NODE_ENV = "development";
    process.env.SMTP_USER = "your-email@example.com"; // placeholder -> should not be treated as real
    process.env.SMTP_PASS = "your-app-password"; // placeholder -> should not be treated as real
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;

    const sendMail = vi
      .fn()
      .mockResolvedValue({ response: '{"jsonTransport":true}' });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendEmail({
      to: "t@example.com",
      subject: "JsonTransport path",
      html: "<p>Hi</p>",
    });

    expect(ok).toBe(true);
    expect(createTransportSpy).toHaveBeenCalledWith({ jsonTransport: true });
    expect(sendMail).toHaveBeenCalled();
  });

  it("sendEventCreatedEmail respects FRONTEND_URL override in text", async () => {
    process.env.NODE_ENV = "development";
    process.env.FRONTEND_URL = "https://prod.app";
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-evt" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendEventCreatedEmail(
      "u@example.com",
      "User",
      {
        title: "Big Event",
        date: "2025-12-31",
        time: "18:00",
        endTime: "19:00",
        location: "Main Hall",
        organizer: "Org",
        purpose: "Celebrate",
        format: "In-person",
      }
    );

    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalled();
    expect(sentArgs?.text).toContain("https://prod.app/dashboard/upcoming");
  });

  it("sendDemotionNotificationToAdmins includes Security Review link for Critical impact (Super Admin -> Leader)", async () => {
    process.env.NODE_ENV = "development";
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-admin" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await (EmailService as any).sendDemotionNotificationToAdmins(
      "admin@example.com",
      "Jane Doe",
      {
        _id: "user-1",
        firstName: "Adam",
        lastName: "Smith",
        email: "adam@example.com",
        oldRole: "Super Admin",
        newRole: "Leader",
      },
      {
        firstName: "Grace",
        lastName: "Admin",
        email: "grace.admin@example.com",
        role: "Administrator",
      },
      "Policy update"
    );

    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalled();
    expect(sentArgs?.html).toContain("/admin/security-review");
  });
});
