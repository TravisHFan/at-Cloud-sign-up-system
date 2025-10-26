import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendEventCreatedEmail - default URL and copy coverage", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;
  let sentArgs: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    process.env.NODE_ENV = "development";
    delete process.env.FRONTEND_URL; // force default localhost path
    EmailTransporter.resetTransporter();
    sentArgs = undefined;
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    EmailTransporter.resetTransporter();
    vi.restoreAllMocks();
  });

  it("includes the motivating copy and default dashboard URL when FRONTEND_URL is unset", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-evt-default" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendEventCreatedEmail(
      "u@example.com",
      "User",
      {
        title: "Community Gathering",
        date: "2025-12-01",
        time: "10:00",
        endTime: "12:00",
        location: "Main Hall",
        organizer: "Team",
        purpose: "Fellowship",
        format: "In-person",
      }
    );

    expect(ok).toBe(true);
    const html = String(sentArgs?.html);
    // Motivational text block near target lines
    expect(html).toContain("Don't miss out! Sign up now to secure your spot.");
    // Default URL in dashboard button
    expect(html).toContain("http://localhost:5173/dashboard/upcoming");
  });
});
