import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

// Covers default SMTP_PORT fallback (parseInt(process.env.SMTP_PORT || "587")) in production with real creds
describe("EmailService.getTransporter - production port default fallback", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    EmailTransporter.resetTransporter();
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    EmailTransporter.resetTransporter();
    vi.restoreAllMocks();
  });

  it("uses port 587 when SMTP_PORT is unset (production + real creds)", async () => {
    process.env.NODE_ENV = "production";
    process.env.SMTP_HOST = "smtp.example.com";
    delete (process.env as any).SMTP_PORT; // force default fallback
    process.env.SMTP_SECURE = "true"; // explicit secure true
    process.env.SMTP_USER = "real-user@example.com";
    process.env.SMTP_PASS = "real-pass";

    const sendMail = vi.fn().mockResolvedValue({ messageId: "id-port" });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendEmail({
      to: "t@example.com",
      subject: "Prod port default",
      html: "<p>Hi</p>",
    });

    expect(ok).toBe(true);
    expect(createTransportSpy).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: true,
      auth: { user: "real-user@example.com", pass: "real-pass" },
    });
  });
});
