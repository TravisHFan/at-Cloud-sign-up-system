import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendGuestConfirmationEmail - Organizer contacts", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let createTransportSpy: any;
  let sentArgs: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    process.env.NODE_ENV = "development";
    EmailTransporter.resetTransporter();
    sentArgs = undefined;
    createTransportSpy = vi.spyOn(nodemailer, "createTransport");
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    EmailTransporter.resetTransporter();
    vi.restoreAllMocks();
  });

  it("includes Organizer Contact Information section when organizerDetails provided", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-orgs" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendGuestConfirmationEmail({
      guestEmail: "guest@example.com",
      guestName: "Guest User",
      event: {
        title: "Community Night",
        date: "2025-11-11",
        time: "18:00",
        timeZone: "America/Chicago",
        location: "Main Hall",
        organizerDetails: [
          {
            name: "Alice Smith",
            role: "Organizer",
            email: "alice@example.com",
            phone: "+1 555-0100",
          },
          { name: "Bob Lee", role: "Co-organizer", email: "bob@example.com" },
        ],
      },
      role: { name: "Participant" },
      registrationId: "rg-42",
    });

    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalled();
    const html = String(sentArgs?.html || "");
    const text = String(sentArgs?.text || "");
    expect(html).toContain("Organizer Contact Information");
    expect(html).toContain("Alice Smith");
    expect(html).toContain("alice@example.com");
    expect(html).toContain("+1 555-0100");
    expect(html).toContain("Bob Lee");
    expect(text).toContain("Organizer Contact Information:");
    expect(text).toContain("Alice Smith (Organizer)");
    expect(text).toContain("bob@example.com");
  });

  it("omits Organizer Contact Information when organizerDetails empty", async () => {
    const sendMail = vi.fn().mockImplementation(async (opts: any) => {
      sentArgs = opts;
      return { messageId: "id-no-orgs" };
    });
    createTransportSpy.mockReturnValue({ sendMail } as any);

    const ok = await EmailService.sendGuestConfirmationEmail({
      guestEmail: "guest2@example.com",
      guestName: "Guest User",
      event: {
        title: "Community Night",
        date: "2025-11-11",
        organizerDetails: [],
      },
      role: { name: "Participant" },
      registrationId: "rg-43",
    });

    expect(ok).toBe(true);
    const html = String(sentArgs?.html || "");
    const text = String(sentArgs?.text || "");
    expect(html).not.toContain("Organizer Contact Information</h3>");
    expect(text).not.toContain("Organizer Contact Information:");
  });
});
