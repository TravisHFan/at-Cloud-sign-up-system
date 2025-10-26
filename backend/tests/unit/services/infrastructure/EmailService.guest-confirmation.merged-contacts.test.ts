import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

// capture payloads by mocking sendEmail
let lastPayload: { html?: string; text?: string } = {};
const originalSendEmail = EmailService.sendEmail;

describe("EmailService.sendGuestConfirmationEmail - merged primary Organizer + co-organizers", () => {
  beforeAll(() => {
    EmailService.sendEmail = vi.fn(async (options: any) => {
      lastPayload = { html: options.html, text: options.text };
      return true;
    }) as any;
  });

  afterAll(() => {
    (EmailService.sendEmail as any) = originalSendEmail;
  });

  it("includes primary Organizer from createdBy plus co-organizers from organizerDetails (de-duped by email)", async () => {
    await EmailService.sendGuestConfirmationEmail({
      guestEmail: "guest@example.com",
      guestName: "Guest User",
      event: {
        title: "Merged Contacts Event",
        date: "2025-12-01",
        time: "10:00",
        timeZone: "America/New_York",
        createdBy: {
          firstName: "Primary",
          lastName: "Organizer",
          email: "primary@org.com",
          phone: "+1 111-1111",
        },
        organizerDetails: [
          {
            name: "Co One",
            role: "Co-organizer",
            email: "co1@org.com",
            phone: "+1 222-2222",
          },
          {
            name: "Dup Primary",
            role: "Organizer",
            email: "primary@org.com",
            phone: "+1 999-9999",
          },
        ],
      },
      role: { name: "Participant" },
      registrationId: "r-1",
    });

    const html = String(lastPayload.html || "");
    const text = String(lastPayload.text || "");

    // Section present
    expect(html).toContain("Organizer Contact Information");

    // Contains primary Organizer from createdBy
    expect(html).toMatch(/Primary\s+Organizer/);
    expect(html).toContain("primary@org.com");
    expect(text).toContain("Primary Organizer (Organizer)");

    // Contains co-organizer
    expect(html).toContain("Co One");
    expect(html).toContain("co1@org.com");
    expect(text).toMatch(/Co One \(Co-organizer\)/);

    // De-duplication by email should avoid duplicate primary@org.com entry from organizerDetails
    // Count 'mailto:' anchor (appears once per contact). The visible text also contains the email, so we match the href to avoid double counting.
    const mailtoOccurrences = (html.match(/mailto:primary@org\.com/g) || [])
      .length;
    expect(mailtoOccurrences).toBe(1);
  });
});
