import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// Covers production && hasRealCredentials short-circuit false branch -> jsonTransport
describe("EmailService.getTransporter - production with placeholder creds uses jsonTransport", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    process.env.NODE_ENV = "production";
    (EmailService as any).transporter = null;
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    (EmailService as any).transporter = null;
    vi.restoreAllMocks();
  });

  it("falls back to jsonTransport when SMTP_USER/PASS are placeholders", async () => {
    process.env.SMTP_USER = "your-email@example.com"; // placeholder -> not real
    process.env.SMTP_PASS = "your-app-password"; // placeholder -> not real
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;

    const sendMail = vi
      .fn()
      .mockResolvedValue({ response: '{"jsonTransport":true}' });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendEmail({
      to: "t@example.com",
      subject: "Prod placeholder",
      html: "<p>Hi</p>",
    });

    expect(ok).toBe(true);
    expect(createTransportSpy).toHaveBeenCalledWith({ jsonTransport: true });
    expect(sendMail).toHaveBeenCalled();
  });
});
