import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService.sendEventCreatedEmail no-zoomLink branch", () => {
  let spy: any;

  beforeEach(() => {
    spy = vi.spyOn(EmailService as any, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("omits join link when zoomLink is not provided", async () => {
    const ok = await (EmailService as any).sendEventCreatedEmail(
      "u@example.com",
      "User",
      {
        title: "E1",
        date: "2025-01-01",
        time: "09:00",
        endTime: "10:00",
        organizer: "Org",
        purpose: "P",
        format: "In Person",
        location: "Hall A",
      }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).not.toMatch(/Join Link/);
  });
});
