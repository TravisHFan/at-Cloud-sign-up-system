import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// We validate the server-side unified date-time range by intercepting the HTML
// produced by sendEventReminderEmail, which uses EmailService.formatDateTimeRange.
describe("EmailService.formatDateTimeRange (indirect via sendEventReminderEmail)", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let sendEmailSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    process.env.NODE_ENV = "test"; // ensure we never attempt to send
    // Intercept sendEmail to inspect its payload
    // Use loose typing to avoid strict signature mismatch in MockInstance generics
    sendEmailSpy = vi
      .spyOn(EmailService as any, "sendEmail")
      .mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...baseEnv } as any;
    vi.restoreAllMocks();
  });

  function getHtml(): string {
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    const call = (sendEmailSpy as any).mock.calls[0]?.[0] as any;
    expect(call && call.html).toBeTruthy();
    return String(call.html);
  }

  function extractDateTimeLine(html: string): string {
    const re = /<p><strong>Date & Time:<\/strong>\s*([^<]+)<\/p>/i;
    const m = html.match(re);
    return m ? m[1].trim() : "";
  }

  it("renders same-day range as full left + time-only right", async () => {
    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "User",
      {
        title: "Same-day Event",
        date: "2025-08-16",
        time: "14:00",
        endTime: "17:30",
        location: "Main Hall",
        format: "In-person",
      },
      "24h"
    );

    const html = getHtml();
    const line = extractDateTimeLine(html);
    // Same-day should contain one hyphen with time-only right side
    expect(line.includes(" - ")).toBe(true);
    // Left date appears once
    const dateMentions = (line.match(/August\s+16,\s+2025/g) || []).length;
    expect(dateMentions).toBe(1);
    // Right side shows time (e.g., 5:30 PM) rather than a second date
    expect(/\b5:30\s*(AM|PM)\b/i.test(line)).toBe(true);
  });

  it("renders multi-day range as full left and full right with dates", async () => {
    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "User",
      {
        title: "Overnight Event",
        date: "2025-08-16", // Saturday
        time: "22:00",
        endDate: "2025-08-17", // Sunday
        endTime: "01:00",
        location: "Main Hall",
        format: "In-person",
      },
      "1h"
    );

    const html = getHtml();
    const line = extractDateTimeLine(html);
    // Should include both dates in the combined range
    expect(line).toMatch(/Saturday|August\s+16,\s+2025/);
    expect(line).toMatch(/Sunday|August\s+17,\s+2025/);
    // Ensure a hyphen separates the range
    expect(line.includes(" - ")).toBe(true);
  });

  it("shows only the start when endTime is missing", async () => {
    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "User",
      {
        title: "No End Time",
        date: "2025-08-16",
        time: "09:00",
        location: "Main Hall",
        format: "In-person",
      },
      "1week"
    );

    const html = getHtml();
    const line = extractDateTimeLine(html);
    // No hyphen should be present in the Date & Time line
    expect(line.includes(" - ")).toBe(false);
  });

  it("formats with explicit timeZone and yields different outputs across zones", async () => {
    // First: America/Los_Angeles
    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "User",
      {
        title: "TimeZone Event",
        date: "2025-06-15",
        time: "10:00",
        endTime: "12:00",
        location: "Main Hall",
        format: "In-person",
        timeZone: "America/Los_Angeles",
      },
      "24h"
    );
    const call0 = (sendEmailSpy as any).mock.calls[0]?.[0] as any;
    const lineLA = extractDateTimeLine(String(call0.html));

    // Second: Asia/Tokyo — same nominal inputs, different zone
    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "User",
      {
        title: "TimeZone Event",
        date: "2025-06-15",
        time: "10:00",
        endTime: "12:00",
        location: "Main Hall",
        format: "In-person",
        timeZone: "Asia/Tokyo",
      },
      "24h"
    );
    const call1 = (sendEmailSpy as any).mock.calls[1]?.[0] as any;
    const lineTokyo = extractDateTimeLine(String(call1.html));

    // Expect formatted lines to differ across time zones
    expect(lineLA).toBeTruthy();
    expect(lineTokyo).toBeTruthy();
    expect(lineLA).not.toEqual(lineTokyo);
  });

  it("handles DST spring-forward in America/New_York (same-day range remains time-only on right)", async () => {
    // US DST starts on 2025-03-09 in America/New_York at 2:00 AM → clocks jump to 3:00 AM
    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "User",
      {
        title: "DST Forward",
        date: "2025-03-09",
        time: "01:30",
        endTime: "03:30",
        location: "Main Hall",
        format: "In-person",
        timeZone: "America/New_York",
      },
      "1h"
    );

    const html = getHtml();
    const line = extractDateTimeLine(html);
    // Still a same-day range (no endDate provided) → time-only on the right
    expect(line.includes(" - ")).toBe(true);
    const yearMentions = (line.match(/2025/g) || []).length;
    expect(yearMentions).toBe(1);
    // Ensure the left side date corresponds to the expected calendar date
    expect(line).toMatch(/March\s+9,\s+2025/);
  });

  it("handles DST fall-back in America/New_York (same-day range remains time-only on right)", async () => {
    // US DST ends on 2025-11-02 in America/New_York at 2:00 AM → clocks fall back to 1:00 AM
    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "User",
      {
        title: "DST Back",
        date: "2025-11-02",
        time: "01:30",
        endTime: "02:15",
        location: "Main Hall",
        format: "In-person",
        timeZone: "America/New_York",
      },
      "1h"
    );

    const html = getHtml();
    const line = extractDateTimeLine(html);
    // Still a same-day range (no endDate provided) → time-only on the right
    expect(line.includes(" - ")).toBe(true);
    const yearMentions = (line.match(/2025/g) || []).length;
    expect(yearMentions).toBe(1);
    expect(line).toMatch(/November\s+2,\s+2025/);
  });

  it("renders multi-day range spanning a DST boundary (America/New_York)", async () => {
    // Spans the fall-back night from Nov 1 to Nov 2, 2025 in New York
    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "User",
      {
        title: "DST Span Multi-day",
        date: "2025-11-01",
        time: "23:30",
        endDate: "2025-11-02",
        endTime: "01:30",
        location: "Main Hall",
        format: "In-person",
        timeZone: "America/New_York",
      },
      "24h"
    );

    const html = getHtml();
    const line = extractDateTimeLine(html);
    // Multi-day should show full left and full right with dates (be tolerant to environment base TZ)
    expect(line.includes(" - ")).toBe(true);
    const parts = line.split(" - ");
    expect(parts.length).toBe(2);
    // Both sides contain a full date like "Month D, 2025" and a time ("at HH:MM AM/PM")
    const fullDateRe =
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+2025/;
    const timeRe = /\bat\s+\d{1,2}:\d{2}\s*(AM|PM)\b/i;
    expect(fullDateRe.test(parts[0])).toBe(true);
    expect(fullDateRe.test(parts[1])).toBe(true);
    expect(timeRe.test(parts[0])).toBe(true);
    expect(timeRe.test(parts[1])).toBe(true);
    // Ensure the known end calendar date appears somewhere
    expect(line).toMatch(/November\s+2,\s+2025/);
  });

  it("supports edge time zones (Pacific/Auckland vs Asia/Kolkata) with distinct outputs", async () => {
    // Auckland (NZ) vs Kolkata (half-hour offset) should produce different lines
    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "User",
      {
        title: "Edge TZ Event",
        date: "2025-06-15",
        time: "10:00",
        endTime: "12:30",
        location: "Main Hall",
        format: "In-person",
        timeZone: "Pacific/Auckland",
      },
      "24h"
    );
    const callA = (sendEmailSpy as any).mock.calls[0]?.[0] as any;
    const lineAuckland = extractDateTimeLine(String(callA.html));

    await EmailService.sendEventReminderEmail(
      "user@example.com",
      "User",
      {
        title: "Edge TZ Event",
        date: "2025-06-15",
        time: "10:00",
        endTime: "12:30",
        location: "Main Hall",
        format: "In-person",
        timeZone: "Asia/Kolkata",
      },
      "24h"
    );
    const callK = (sendEmailSpy as any).mock.calls[1]?.[0] as any;
    const lineKolkata = extractDateTimeLine(String(callK.html));

    expect(lineAuckland).toBeTruthy();
    expect(lineKolkata).toBeTruthy();
    expect(lineAuckland).not.toEqual(lineKolkata);
  });
});
