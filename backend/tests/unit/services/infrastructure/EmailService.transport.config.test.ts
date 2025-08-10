import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService.getTransporter config branches", () => {
  const env = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...env } as any;
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
    // reset cached transporter between tests
    (EmailService as any).transporter = null;
  });

  afterEach(() => {
    process.env = { ...env } as any;
    (EmailService as any).transporter = null;
    vi.restoreAllMocks();
  });

  it("production + real creds uses provided host/port/secure/auth", async () => {
    process.env.NODE_ENV = "production";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "real-user@example.com";
    process.env.SMTP_PASS = "real-app-pass";

    // Provide fake transporter to avoid network
    createTransportSpy.mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: "id-1" }),
    } as any);

    const ok = await EmailService.sendEmail({
      to: "a@b.com",
      subject: "Prod",
      html: "<p>Hi</p>",
    });
    expect(ok).toBe(true);
    expect(createTransportSpy).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: { user: "real-user@example.com", pass: "real-app-pass" },
    });
  });

  it("production + real creds with SMTP_SECURE unset defaults to secure=false", async () => {
    process.env.NODE_ENV = "production";
    process.env.SMTP_HOST = "smtp.prod.local";
    process.env.SMTP_PORT = "587";
    delete process.env.SMTP_SECURE; // should coerce to false
    process.env.SMTP_USER = "prod-user@example.com";
    process.env.SMTP_PASS = "prod-pass";

    createTransportSpy.mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: "id-1b" }),
    } as any);

    const ok = await EmailService.sendEmail({
      to: "a@b.com",
      subject: "Prod default secure",
      html: "<p>Hi</p>",
    });
    expect(ok).toBe(true);
    expect(createTransportSpy).toHaveBeenCalledWith({
      host: "smtp.prod.local",
      port: 587,
      secure: false,
      auth: { user: "prod-user@example.com", pass: "prod-pass" },
    });
  });

  it("development + real creds uses default host smtp.gmail.com and secure=false when SMTP_HOST unset", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.SMTP_HOST;
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "real-user@example.com";
    process.env.SMTP_PASS = "real-app-pass";

    createTransportSpy.mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: "id-2" }),
    } as any);

    const ok = await EmailService.sendEmail({
      to: "a@b.com",
      subject: "Dev",
      html: "<p>Hi</p>",
    });
    expect(ok).toBe(true);
    expect(createTransportSpy).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: "real-user@example.com", pass: "real-app-pass" },
    });
  });
});
