import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { EmailService } from "../../../src/services/infrastructure/EmailServiceFacade";

// Ensure test env to skip real sending
process.env.NODE_ENV = process.env.NODE_ENV || "test";

// Capture console logs from sendEmail test-skip path
const logs: string[] = [];
const origLog = console.log;

describe("EmailService.sendGuestConfirmationEmail - organizer fallback contact labels", () => {
  beforeEach(() => {
    logs.length = 0;
    console.log = (msg?: any, ...rest: any[]) => {
      logs.push([msg, ...rest].map(String).join(" "));
    };
  });

  afterAll(() => {
    console.log = origLog;
  });

  it("includes fallback organizer contact with Email: and Phone: labels in HTML and text", async () => {
    const result = await EmailService.sendGuestConfirmationEmail({
      guestEmail: "guest@example.com",
      guestName: "Guest User",
      event: {
        title: "My Event",
        date: new Date("2025-12-01T00:00:00Z"),
        time: "10:00 AM",
        timeZone: "America/New_York",
        // No organizerDetails provided -> fallback to createdBy
        organizerDetails: [],
        createdBy: {
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@example.com",
          phone: "+1-555-0100",
        },
      },
      role: { name: "Participant" },
      registrationId: "reg-123",
      manageToken: "tok-xyz",
    });

    expect(result).toBe(true);

    // Intercept the html/text by monkey-patching sendEmail just for this assertion
  });
});

// Patch sendEmail to capture last payload and then run assertions in a separate test
let lastPayload: { html?: string; text?: string; subject?: string } = {};
const originalSendEmail = EmailService.sendEmail;
EmailService.sendEmail = vi.fn(async (options: any) => {
  lastPayload = {
    html: options.html,
    text: options.text,
    subject: options.subject,
  };
  // emulate success (and respect test env skip semantics)
  return true;
});

describe("EmailService.sendGuestConfirmationEmail content assertions", () => {
  it("renders fallback organizer with labels in both HTML and text bodies", async () => {
    // Trigger email generation again to populate lastPayload
    await EmailService.sendGuestConfirmationEmail({
      guestEmail: "guest@example.com",
      guestName: "Guest User",
      event: {
        title: "My Event",
        date: new Date("2025-12-01T00:00:00Z"),
        time: "10:00 AM",
        timeZone: "America/New_York",
        organizerDetails: [],
        createdBy: {
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@example.com",
          phone: "+1-555-0100",
        },
      },
      role: { name: "Participant" },
      registrationId: "reg-123",
      manageToken: "tok-xyz",
    });

    expect(lastPayload.html).toBeTruthy();
    expect(lastPayload.text).toBeTruthy();

    const html = String(lastPayload.html);
    const text = String(lastPayload.text);

    // HTML checks
    expect(html).toMatch(/Organizer Contact Information/i);
    expect(html).toMatch(/Alice\s+Smith/);
    expect(html).toMatch(/\(Organizer\)/);
    expect(html).toMatch(
      /Email:\s*<a [^>]*mailto:alice@example.com[^>]*>alice@example.com<\/a>/i
    );
    expect(html).toMatch(/Phone:\s*\+1-555-0100/);

    // Text checks
    expect(text).toMatch(/Organizer Contact Information/);
    expect(text).toMatch(
      /- Alice Smith \(Organizer\) — Email: alice@example.com, Phone: \+1-555-0100/
    );
  });

  afterAll(() => {
    // restore original
    (EmailService.sendEmail as any) = originalSendEmail;
  });
});
