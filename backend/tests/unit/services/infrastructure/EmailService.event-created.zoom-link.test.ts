import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendEventCreatedEmail - zoomLink and dashboard button", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;
  let sentArgs: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    process.env.NODE_ENV = "development";
    process.env.FRONTEND_URL = "https://app.example.com";
    EmailTransporter.resetTransporter();
    sentArgs = undefined;
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    EmailTransporter.resetTransporter();
    vi.restoreAllMocks();
  });

  it("renders the join link section when zoomLink provided and uses FRONTEND_URL in dashboard button", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-evt-zoom" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendEventCreatedEmail(
      "u@example.com",
      "User Name",
      {
        title: "Prayer Night",
        date: "2025-11-20",
        time: "19:00",
        endTime: "20:00",
        location: "Online",
        organizer: "Team",
        purpose: "Prayer",
        format: "Virtual",
        zoomLink: "https://zoom.us/j/123",
      }
    );

    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalled();
    const html = String(sentArgs?.html);
    expect(html).toContain("<strong>🔗 Join Link:</strong>");
    expect(html).toContain("https://zoom.us/j/123");
    expect(html).toContain("https://app.example.com/dashboard/upcoming");
  });
});
