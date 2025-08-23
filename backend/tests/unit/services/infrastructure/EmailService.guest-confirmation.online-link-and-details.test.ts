import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

/**
 * This suite verifies guest confirmation email contains Online Meeting Link and Meeting Details
 * when available, and falls back to the specified message when missing.
 */
describe("EmailService.sendGuestConfirmationEmail - Online Meeting Link + Meeting Details", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;
  let sentArgs: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    process.env.NODE_ENV = "development";
    process.env.FRONTEND_URL = "https://app.example.com";
    (EmailService as any).transporter = null;
    sentArgs = undefined;
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    (EmailService as any).transporter = null;
    vi.restoreAllMocks();
  });

  it("renders link and details when provided", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-guest-link-details" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendGuestConfirmationEmail({
      guestEmail: "g@example.com",
      guestName: "Guest User",
      event: {
        title: "Hybrid Workshop",
        date: "2025-12-25",
        time: "10:00",
        endTime: "12:00",
        endDate: "2025-12-25",
        timeZone: "America/Los_Angeles",
        format: "Hybrid Participation",
        isHybrid: true,
        location: "Online & In-person",
        zoomLink: "https://zoom.us/j/abc",
        agenda: "Intro\nDiscussion\nQ&A",
        purpose: "Grow in faith",
        description: "This is a hybrid workshop for all levels.",
        meetingId: "123-456-789",
        passcode: "p@55",
        organizerDetails: [
          {
            name: "Alice Smith",
            role: "Organizer",
            email: "alice@example.com",
            phone: "+1 555-0100",
          },
        ],
      },
      role: { name: "Participant" },
      registrationId: "rg-1",
      manageToken: "tok-123",
    });

    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalled();
    const html = String(sentArgs?.html);
    const text = String(sentArgs?.text);
    expect(html).toContain("Online Meeting Link");
    expect(html).toContain("https://zoom.us/j/abc");
    expect(html).toContain("Meeting Details");
    expect(html).toContain("Meeting ID:");
    expect(html).toContain("Passcode:");
    // Additional sections
    expect(html).toContain("Purpose");
    expect(html).toContain("Grow in faith");
    expect(html).toContain("Description");
    expect(html).toContain("This is a hybrid workshop for all levels.");
    expect(html).toContain("Event Agenda and Schedule");
    expect(html).toContain("Intro");
    expect(html).toContain("Q&amp;A");
    expect(html).toContain("Organizer Contact Information");
    expect(html).toContain("Alice Smith");
    // Text variant also includes link and meeting ID/passcode and other sections
    expect(text).toContain("Online Meeting Link:");
    expect(text).toContain("https://zoom.us/j/abc");
    expect(text).toContain("Meeting ID:");
    expect(text).toContain("Passcode:");
    expect(text).toContain("Purpose:");
    expect(text).toContain("Description:");
    expect(text).toContain("Event Agenda and Schedule:");
    expect(text).toContain("Organizer Contact Information:");
  });

  it("renders fallback message when link or details missing", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-guest-fallback" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendGuestConfirmationEmail({
      guestEmail: "g2@example.com",
      guestName: "Guest User",
      event: {
        title: "Online Prayer",
        date: "2025-10-20",
        time: "19:00",
        endTime: "20:00",
        endDate: "2025-10-20",
        timeZone: "America/Chicago",
        format: "Online",
        location: "Virtual",
        // Missing zoomLink and details
      } as any,
      role: { name: "Participant" },
      registrationId: "rg-2",
    });

    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalled();
    const html = String(sentArgs?.html);
    const text = String(sentArgs?.text);
    const fallback =
      "The meeting link and event details will be provided via a separate email once confirmed. We appreciate your patience.";
    expect(html).toContain(fallback);
    expect(text).toContain(fallback);
    // Should not show explicit sections
    expect(html).not.toContain("Online Meeting Link</h3>");
    expect(html).not.toContain("Meeting Details</h3>");
  });
});
