import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService.sendEmail from-address branch", () => {
  const realEnv = { ...process.env } as NodeJS.ProcessEnv;
  let getTransporterSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...realEnv };
    process.env.NODE_ENV = "development";
    getTransporterSpy = vi
      .spyOn(EmailService as any, "getTransporter")
      .mockReturnValue({
        sendMail: vi.fn().mockResolvedValue({ messageId: "id" }),
      } as any);
  });

  afterEach(() => {
    process.env = { ...realEnv };
    vi.restoreAllMocks();
  });

  it("uses default from when EMAIL_FROM not set", async () => {
    delete process.env.EMAIL_FROM;
    const send = vi.fn().mockResolvedValue({ messageId: "id1" });
    (EmailService as any).getTransporter = vi.fn(() => ({ sendMail: send }));
    const ok = await EmailService.sendEmail({
      to: "t@example.com",
      subject: "S",
      html: "<p>H</p>",
    });
    expect(ok).toBe(true);
    const mailArgs = send.mock.calls[0][0];
    expect(mailArgs.from).toBe('"@Cloud Ministry" <atcloudministry@gmail.com>');
  });

  it("uses provided EMAIL_FROM when set", async () => {
    process.env.EMAIL_FROM = '"Custom" <custom@example.com>';
    const send = vi.fn().mockResolvedValue({ messageId: "id2" });
    (EmailService as any).getTransporter = vi.fn(() => ({ sendMail: send }));
    const ok = await EmailService.sendEmail({
      to: "t@example.com",
      subject: "S2",
      html: "<p>H</p>",
    });
    expect(ok).toBe(true);
    const mailArgs = send.mock.calls[0][0];
    expect(mailArgs.from).toBe('"Custom" <custom@example.com>');
  });
});
