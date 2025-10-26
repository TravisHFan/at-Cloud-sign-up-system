import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

// Test specifically for the timezone bug fix in event update emails
describe("EmailService.timezone-fix - event update email time formatting", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let sendEmailSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    process.env.NODE_ENV = "test"; // ensure we never attempt to send
    // Intercept sendEmail to inspect its payload
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
    const re = /<strong>📅 Date & Time:<\/strong>\s*([^<]+)</i;
    const m = html.match(re);
    return m ? m[1].trim() : "";
  }

  it("formats event update email times correctly when event is in different DST period than current date", async () => {
    // This test verifies the fix for the timezone bug where end times would show incorrect
    // times due to using the current date instead of the event date for timezone calculations

    // Simulate an event in summer (DST active) when current date is in winter (DST inactive)
    // Event: Sep 13, 2025 (DST active in America/New_York)
    // Time: 4:00 PM - 6:00 PM Eastern
    // Expected: Should show the correct Eastern times, not shifted by DST difference

    await EmailService.sendEventNotificationEmail(
      "test@example.com",
      "Test User",
      {
        eventTitle: "Test Event",
        date: "2025-09-13", // September, DST active
        time: "16:00", // 4:00 PM
        endTime: "18:00", // 6:00 PM
        timeZone: "America/New_York",
        message: "Event has been updated",
      }
    );

    const html = getHtml();
    const dateTimeLine = extractDateTimeLine(html);

    // The key fix: both start and end times should be correctly calculated
    // using the actual event date (2025-09-13) for timezone conversion,
    // not the current date which might be in a different DST period

    expect(dateTimeLine).toContain("Saturday, September 13, 2025");

    // Both times should be properly converted to the event's timezone on the event's date
    // The exact display format may vary, but both times should be present and correct
    expect(dateTimeLine).toMatch(/4:00\s*(PM|pm)/);
    expect(dateTimeLine).toMatch(/6:00\s*(PM|pm)/);

    // Ensure it's a time range with proper formatting
    expect(dateTimeLine).toContain(" - ");
  });

  it("handles timezone conversion correctly for same-day events across DST boundaries", async () => {
    // Test an event that spans the DST fall-back boundary in America/New_York
    // November 1, 2025 11:30 PM to November 2, 2025 1:30 AM
    // This should correctly handle the timezone shift

    await EmailService.sendEventNotificationEmail(
      "test@example.com",
      "Test User",
      {
        eventTitle: "DST Boundary Event",
        date: "2025-11-01",
        time: "23:30", // 11:30 PM
        endTime: "01:30", // 1:30 AM next day
        endDate: "2025-11-02", // spans to next day
        timeZone: "America/New_York",
        message: "Event spans DST boundary",
      }
    );

    const html = getHtml();
    const dateTimeLine = extractDateTimeLine(html);

    // Should handle the multi-day range correctly
    expect(dateTimeLine).toContain("November 1, 2025");
    expect(dateTimeLine).toContain("November 2, 2025");
    expect(dateTimeLine).toContain(" - ");

    // Should show proper PM and AM times
    expect(dateTimeLine).toMatch(/11:30\s*(PM|pm)/);
    expect(dateTimeLine).toMatch(/1:30\s*(AM|am)/);
  });

  it("formats end time correctly for same-day events using event date for timezone calculation", async () => {
    // This specifically tests the fix in the formatTime method where it now receives
    // the date parameter and uses buildDate instead of new Date()

    await EmailService.sendEventNotificationEmail(
      "test@example.com",
      "Test User",
      {
        eventTitle: "Same Day Event",
        date: "2025-06-15", // Summer date
        time: "14:00", // 2:00 PM
        endTime: "17:00", // 5:00 PM (same day)
        timeZone: "America/Los_Angeles",
        message: "Same day event update",
      }
    );

    const html = getHtml();
    const dateTimeLine = extractDateTimeLine(html);

    // For same-day events, should show full date/time on left, time-only on right
    expect(dateTimeLine).toContain("Sunday, June 15, 2025");
    expect(dateTimeLine).toMatch(/2:00\s*(PM|pm)/);
    expect(dateTimeLine).toMatch(/5:00\s*(PM|pm)/);
    expect(dateTimeLine).toContain(" - ");

    // Verify there's only one date mention (not repeated for same-day)
    const dateMatches = (dateTimeLine.match(/June 15, 2025/g) || []).length;
    expect(dateMatches).toBe(1);
  });
});
