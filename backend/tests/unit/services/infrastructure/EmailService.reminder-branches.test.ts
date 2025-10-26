import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendEventReminderEmail branches", () => {
  let sendEmailSpy: any;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NODE_ENV = "test"; // ensures EmailService.sendEmail returns true
    sendEmailSpy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats Online events with virtual info and join button", async () => {
    const ok = await EmailService.sendEventReminderEmail(
      "u@example.com",
      "User One",
      {
        title: "Online Prayer Meeting",
        date: "2025-12-31",
        time: "19:00",
        location: "Zoom",
        zoomLink: "https://zoom.us/j/xyz",
        format: "Online",
      },
      "24h"
    );
    expect(ok).toBe(true);
    const args = sendEmailSpy.mock.calls[0][0] as any;
    expect(args.subject).toContain("Online Prayer Meeting");
    expect(args.html).toContain("Online Prayer Meeting");
    expect(args.html).toContain("Join");
    expect(args.html).toContain("https://zoom.us/j/xyz");
  });

  it("formats Hybrid events with zoom link variations", async () => {
    const ok = await EmailService.sendEventReminderEmail(
      "u@example.com",
      "User One",
      {
        title: "Hybrid Worship",
        date: "2025-12-31",
        time: "10:00",
        location: "123 Church St",
        zoomLink: "https://zoom.us/j/abc",
        format: "Hybrid Participation",
      },
      "1h"
    );
    expect(ok).toBe(true);
    const args = sendEmailSpy.mock.calls[0][0] as any;
    expect(args.subject).toContain("Hybrid Worship");
    expect(args.html).toContain("Hybrid Worship");
    expect(args.html).toMatch(/Join Online|Virtual Event Access/);
  });

  it("formats In-person events without virtual sections", async () => {
    const ok = await EmailService.sendEventReminderEmail(
      "u@example.com",
      "User One",
      {
        title: "In-person Service",
        date: "2025-12-31",
        time: "09:00",
        location: "Main Hall",
        format: "In-person",
      },
      "1week"
    );
    expect(ok).toBe(true);
    const args = sendEmailSpy.mock.calls[0][0] as any;
    expect(args.subject).toContain("In-person Service");
    expect(args.html).toContain("In-person Service");
    expect(args.html).toContain("Location:");
    // Should not include a zoom link section
    expect(String(args.html)).not.toMatch(/Join Online|Virtual Event Access/);
  });
});
