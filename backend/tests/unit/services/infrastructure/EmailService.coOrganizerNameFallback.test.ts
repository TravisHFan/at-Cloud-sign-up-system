import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService.sendCoOrganizerAssignedEmail name fallbacks", () => {
  let spy: any;
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats names even when first/last missing (trimmed)", async () => {
    const ok = await EmailService.sendCoOrganizerAssignedEmail(
      "co@example.com",
      { firstName: "", lastName: "", email: "co@example.com" } as any,
      {
        title: "Service",
        date: "2025-12-31",
        time: "10:00",
        location: "Main Hall",
        organizer: "Lead",
        purpose: "Help",
        format: "In-person",
      } as any,
      {
        firstName: "Lead",
        lastName: "",
        email: "lead@example.com",
        role: "Leader",
      } as any
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(args.subject).toContain("Co-Organizer Assignment");
    // Ensure no "undefined" and no double spaces in the greeting line specifically (ignore template indentation)
    const greeting =
      String(args.html).match(/<p>Hello[\s\S]*?<\/p>/)?.[0] ?? "";
    expect(greeting).not.toMatch(/undefined/);
    expect(greeting).not.toMatch(/ {2,}/);
  });
});
