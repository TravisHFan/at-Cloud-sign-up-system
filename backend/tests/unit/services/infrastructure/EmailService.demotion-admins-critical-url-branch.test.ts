import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendDemotionNotificationToAdmins - critical URL branch", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;
  let sentArgs: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    process.env.NODE_ENV = "development";
    process.env.FRONTEND_URL = "https://console.example.com";
    EmailTransporter.resetTransporter();
    sentArgs = undefined;
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    EmailTransporter.resetTransporter();
    vi.restoreAllMocks();
  });

  it("renders Security Review anchor with custom FRONTEND_URL for Critical impact", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-admin-critical-url" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "alerts@example.com",
      "Ops Team",
      {
        _id: "u-1",
        firstName: "Sam",
        lastName: "Root",
        email: "sam.root@example.com",
        oldRole: "Super Admin",
        newRole: "Leader",
      },
      {
        firstName: "Grace",
        lastName: "Sec",
        email: "sec@example.com",
        role: "Administrator",
      },
      "audit required"
    );

    expect(ok).toBe(true);
    const html = String(sentArgs?.html);
    expect(html).toContain("https://console.example.com/admin/security-review");
  });
});
