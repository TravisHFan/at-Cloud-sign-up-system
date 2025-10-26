import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

// Tests for timezone-aware formatting in Co-Organizer Assignment email
describe("EmailService Co-Organizer assignment - timezone formatting", () => {
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
    const re =
      /<p><strong>Event:<\/strong>.*?<\/p>\s*<p><strong>Date & Time:<\/strong>\s*([^<]+)<\/p>/is;
    const m = html.match(re);
    return m ? m[1].trim() : "";
  }

  it("renders same-day with time-only right using event TZ", async () => {
    await EmailService.sendCoOrganizerAssignedEmail(
      "co@example.com",
      { firstName: "Co", lastName: "Org" },
      {
        title: "Community Night",
        date: "2025-06-15",
        time: "14:00",
        endTime: "17:00",
        location: "Church",
        timeZone: "America/Los_Angeles",
      } as any,
      { firstName: "Main", lastName: "Organizer" }
    );

    const html = getHtml();
    const line = extractDateTimeLine(html);
    expect(line.includes(" - ")).toBe(true);
    const dateMentions = (line.match(/June\s+15,\s+2025/g) || []).length;
    expect(dateMentions).toBe(1);
    expect(/2:00\s*(PM|AM)/i.test(line)).toBe(true);
    expect(/5:00\s*(PM|AM)/i.test(line)).toBe(true);
  });

  it("produces distinct outputs for different time zones (Auckland vs Kolkata)", async () => {
    await EmailService.sendCoOrganizerAssignedEmail(
      "co@example.com",
      { firstName: "Co", lastName: "Org" },
      {
        title: "TZ Edge",
        date: "2025-06-15",
        time: "10:00",
        endTime: "12:30",
        location: "Church",
        timeZone: "Pacific/Auckland",
      } as any,
      { firstName: "Main", lastName: "Organizer" }
    );
    const callA = (sendEmailSpy as any).mock.calls[0]?.[0] as any;
    const lineAuckland = extractDateTimeLine(String(callA.html));

    await EmailService.sendCoOrganizerAssignedEmail(
      "co@example.com",
      { firstName: "Co", lastName: "Org" },
      {
        title: "TZ Edge",
        date: "2025-06-15",
        time: "10:00",
        endTime: "12:30",
        location: "Church",
        timeZone: "Asia/Kolkata",
      } as any,
      { firstName: "Main", lastName: "Organizer" }
    );
    const callK = (sendEmailSpy as any).mock.calls[1]?.[0] as any;
    const lineKolkata = extractDateTimeLine(String(callK.html));

    expect(lineAuckland).toBeTruthy();
    expect(lineKolkata).toBeTruthy();
    expect(lineAuckland).not.toEqual(lineKolkata);
  });
});
