import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService.sendEventCreatedEmail text branch - Online Meeting", () => {
  const originalEnv = { ...process.env };
  let spy: any;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses 'Online Meeting' in text when format is Online and no location provided", async () => {
    const ok = await EmailService.sendEventCreatedEmail(
      "user@example.com",
      "User",
      {
        title: "Online Prayer",
        date: "2025-12-31",
        time: "10:00",
        endTime: "11:00",
        format: "Online",
        organizer: "Team",
        purpose: "Prayer",
      } as any
    );
    expect(ok).toBe(true);
    const opts = spy.mock.calls[0][0];
    expect(String(opts.text)).toContain("Online Meeting");
  });
});
