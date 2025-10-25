import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

/**
 * Verifies location display rules in guest confirmation emails (updated spec):
 * - Online: force "Location: Online" regardless of stored value.
 * - In-person: include physical location when provided.
 * - Hybrid Participation: include physical location when provided.
 */
describe("EmailService.sendGuestConfirmationEmail - location format rules", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;
  let sentArgs: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    // Use development env so EmailService.sendEmail does NOT short-circuit and we can capture html/text
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

  function extractTextAndHtml() {
    const html = String(sentArgs?.html || "");
    const text = String(sentArgs?.text || "");
    return { html, text };
  }

  it("Online format forces Location: Online even when location missing", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-online" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendGuestConfirmationEmail({
      guestEmail: "guest-online@example.com",
      guestName: "Guest Online",
      event: {
        title: "Pure Online",
        date: "2025-12-01",
        time: "09:00",
        endTime: "10:00",
        endDate: "2025-12-01",
        timeZone: "America/New_York",
        format: "Online",
        // intentionally no location
      } as any,
      role: { name: "Attendee" },
      registrationId: "r-online",
    });
    expect(ok).toBe(true);
    const { html, text } = extractTextAndHtml();
    // HTML wraps label in <strong>, so allow closing tag between label and value
    expect(html).toMatch(/Location:<\/strong>\s*Online/);
    expect(text).toMatch(/Location: Online/);
  });

  it("In-person format includes physical location", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-inperson" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendGuestConfirmationEmail({
      guestEmail: "guest-ip@example.com",
      guestName: "Guest IP",
      event: {
        title: "Physical Event",
        date: "2025-12-02",
        time: "09:00",
        endTime: "10:00",
        endDate: "2025-12-02",
        timeZone: "America/Chicago",
        format: "In-person",
        location: "Conference Hall A",
      } as any,
      role: { name: "Attendee" },
      registrationId: "r-ip",
    });
    expect(ok).toBe(true);
    const { html, text } = extractTextAndHtml();
    expect(html).toMatch(/Location:<\/strong>\s*Conference Hall A/);
    expect(text).toMatch(/Location: Conference Hall A/);
  });

  it("Hybrid Participation format includes physical location", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-hybrid" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendGuestConfirmationEmail({
      guestEmail: "guest-hybrid@example.com",
      guestName: "Guest Hybrid",
      event: {
        title: "Hybrid Experience",
        date: "2025-12-03",
        time: "09:00",
        endTime: "10:00",
        endDate: "2025-12-03",
        timeZone: "America/Los_Angeles",
        format: "Hybrid Participation",
        location: "Hybrid Center",
      } as any,
      role: { name: "Attendee" },
      registrationId: "r-hybrid",
    });
    expect(ok).toBe(true);
    const { html, text } = extractTextAndHtml();
    expect(html).toMatch(/Location:<\/strong>\s*Hybrid Center/);
    expect(text).toMatch(/Location: Hybrid Center/);
  });
});
