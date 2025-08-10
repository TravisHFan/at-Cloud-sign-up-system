import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService.sendEmail branches", () => {
  const realEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = realEnv;
    vi.restoreAllMocks();
  });

  it("short-circuits in test env without transporter", async () => {
    process.env.NODE_ENV = "test";
    const getT = vi.spyOn(EmailService as any, "getTransporter");
    const ok = await EmailService.sendEmail({
      to: "a@b.com",
      subject: "S",
      html: "<p>H</p>",
    });
    expect(ok).toBe(true);
    expect(getT).not.toHaveBeenCalled();
  });

  it("returns true when jsonTransport response is detected", async () => {
    process.env.NODE_ENV = "development";
    const sendMail = vi
      .fn()
      .mockResolvedValue({ response: '{"jsonTransport":true}' });
    vi.spyOn(EmailService as any, "getTransporter").mockReturnValue({
      sendMail,
    } as any);

    const ok = await EmailService.sendEmail({
      to: "a@b.com",
      subject: "Dev",
      html: "<p>H</p>",
    });
    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalled();
  });

  it("returns false when transporter throws", async () => {
    process.env.NODE_ENV = "development";
    const sendMail = vi.fn().mockRejectedValue(new Error("boom"));
    vi.spyOn(EmailService as any, "getTransporter").mockReturnValue({
      sendMail,
    } as any);

    const ok = await EmailService.sendEmail({
      to: "a@b.com",
      subject: "Err",
      html: "<p>H</p>",
    });
    expect(ok).toBe(false);
  });
});
