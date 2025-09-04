import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// Tests for timezone-aware formatting in sendEventCreatedEmail
describe("EmailService.sendEventCreatedEmail - timezone formatting", () => {
  const baseEnv = { ...process.env } as Record<string, string>;
  let sendEmailSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...baseEnv } as any;
    process.env.NODE_ENV = "test";
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

  it("renders same-day range as full left + time-only right for LA timezone", async () => {
    await EmailService.sendEventCreatedEmail("user@example.com", "User", {
      title: "Same-day Event",
      date: "2025-06-15",
      time: "10:00",
      endTime: "12:30",
      location: "Main Hall",
      organizer: "Team Lead",
      purpose: "Community",
      format: "In-person",
      timeZone: "America/Los_Angeles",
    });

    const html = getHtml();
    const line = extractDateTimeLine(html);
    expect(line.includes(" - ")).toBe(true);
    const dateMentions = (line.match(/June\s+15,\s+2025/g) || []).length;
    expect(dateMentions).toBe(1);
    expect(/10:00\s*(AM|PM)/i.test(line)).toBe(true);
    expect(/12:30\s*(AM|PM)/i.test(line)).toBe(true);
  });

  it("produces distinct outputs for different time zones (LA vs Tokyo)", async () => {
    await EmailService.sendEventCreatedEmail("user@example.com", "User", {
      title: "TZ Compare",
      date: "2025-06-15",
      time: "10:00",
      endTime: "12:00",
      location: "Main Hall",
      organizer: "Team Lead",
      purpose: "Community",
      format: "In-person",
      timeZone: "America/Los_Angeles",
    });
    const callLA = (sendEmailSpy as any).mock.calls[0]?.[0] as any;
    const lineLA = extractDateTimeLine(String(callLA.html));

    await EmailService.sendEventCreatedEmail("user@example.com", "User", {
      title: "TZ Compare",
      date: "2025-06-15",
      time: "10:00",
      endTime: "12:00",
      location: "Main Hall",
      organizer: "Team Lead",
      purpose: "Community",
      format: "In-person",
      timeZone: "Asia/Tokyo",
    });
    const callTokyo = (sendEmailSpy as any).mock.calls[1]?.[0] as any;
    const lineTokyo = extractDateTimeLine(String(callTokyo.html));

    expect(lineLA).toBeTruthy();
    expect(lineTokyo).toBeTruthy();
    expect(lineLA).not.toEqual(lineTokyo);
  });

  it("renders multi-day range (full left and full right) with timezone", async () => {
    await EmailService.sendEventCreatedEmail("user@example.com", "User", {
      title: "Overnight Event",
      date: "2025-08-16",
      time: "22:00",
      endDate: "2025-08-17",
      endTime: "01:00",
      location: "Main Hall",
      organizer: "Team Lead",
      purpose: "Community",
      format: "In-person",
      timeZone: "America/New_York",
    });

    const html = getHtml();
    const line = extractDateTimeLine(html);
    expect(line.includes(" - ")).toBe(true);
    const fullDateRe =
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+2025/;
    const timeRe = /\bat\s+\d{1,2}:\d{2}\s*(AM|PM)\b/i;
    const parts = line.split(" - ");
    expect(parts.length).toBe(2);
    expect(fullDateRe.test(parts[0])).toBe(true);
    expect(fullDateRe.test(parts[1])).toBe(true);
    expect(timeRe.test(parts[0])).toBe(true);
    expect(timeRe.test(parts[1])).toBe(true);
  });
});
