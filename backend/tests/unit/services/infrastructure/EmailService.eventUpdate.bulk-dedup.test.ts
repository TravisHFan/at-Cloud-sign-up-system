import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService.sendEventNotificationEmailBulk - deduplicates by email", () => {
  let sendEmailSpy: any;
  beforeEach(() => {
    sendEmailSpy = vi
      .spyOn(EmailService as any, "sendEmail")
      .mockResolvedValue(true);
  });
  afterEach(() => {
    sendEmailSpy.mockRestore();
  });

  it("sends only once per email even if recipient list has duplicates (multiple roles)", async () => {
    const payload = {
      eventTitle: "Bulk Dedup Event",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      timeZone: "America/Los_Angeles",
      message: "Event edited",
    };

    const recipients = [
      { email: "multi@example.com", name: "User A" },
      { email: "MULTI@example.com", name: "User A (Role 2)" },
      { email: "unique@example.com", name: "User B" },
    ];

    const results = await EmailService.sendEventNotificationEmailBulk(
      recipients as any,
      payload as any
    );

    expect(results.length).toBe(2);
    // sendEmail should be called only twice (multi@example.com once + unique@example.com once)
    // Note: EmailService.sendEventNotificationEmailBulk calls sendEventNotificationEmail which then calls sendEmail once each.
    // We spy on sendEmail to count the final sends.
    expect(sendEmailSpy).toHaveBeenCalledTimes(2);
  });
});
