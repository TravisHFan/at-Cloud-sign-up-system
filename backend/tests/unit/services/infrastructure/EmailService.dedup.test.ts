import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";
import { EventEmailService } from "../../../../src/services/email/domains/EventEmailService";

describe("EmailService deduplication (bulk helpers)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = "test"; // ensure emails are skipped (no transport)
  });

  it("sendEventNotificationEmailBulk de-duplicates recipients by email", async () => {
    const spy = vi
      .spyOn(EventEmailService as any, "sendEventNotificationEmail")
      .mockResolvedValue(true);

    const recipients = [
      { email: "dup@example.com", name: "User One" },
      { email: "Dup@example.com", name: "User Two" }, // case variant
      { email: "unique@example.com", name: "Unique User" },
      { email: "dup@example.com", name: "User Three" }, // exact dup
    ];

    const payload = {
      eventTitle: "Test Event",
      date: "2025-12-01",
      time: "10:00",
      endTime: "12:00",
      timeZone: "America/Los_Angeles",
      message: "Edited",
    } as any;

    const results = await EmailService.sendEventNotificationEmailBulk(
      recipients,
      payload
    );

    // Expect only one call for dup@example.com and one for unique@example.com
    expect(spy).toHaveBeenCalledTimes(2);
    const calledEmails = (spy as any).mock.calls.map((args: any[]) => args[0]);
    expect(calledEmails.sort()).toEqual(
      ["dup@example.com", "unique@example.com"].sort()
    );
    // Results length should equal number of unique emails
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
  });

  it("sendEventReminderEmailBulk de-duplicates recipients by email", async () => {
    const spy = vi
      .spyOn(EventEmailService as any, "sendEventReminderEmail")
      .mockResolvedValue(true);

    const recipients = [
      { email: "a@example.com", name: "A" },
      { email: "A@example.com", name: "A2" }, // case variant
      { email: "b@example.com", name: "B" },
      { email: "a@example.com", name: "A3" },
    ];

    const eventData = {
      title: "Reminder Event",
      date: "2025-12-01",
      time: "09:00",
      endTime: "10:00",
      location: "Room 101",
      format: "In-person",
      timeZone: "America/Los_Angeles",
    } as const;

    const results = await EmailService.sendEventReminderEmailBulk(
      recipients,
      eventData,
      "24h"
    );

    expect(spy).toHaveBeenCalledTimes(2);
    const calledEmails = (spy as any).mock.calls.map((args: any[]) => args[0]);
    expect(calledEmails.sort()).toEqual(
      ["a@example.com", "b@example.com"].sort()
    );
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
  });
});
