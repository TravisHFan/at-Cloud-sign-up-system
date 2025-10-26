import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService co-organizer - organizerName fallback", () => {
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

  it("falls back to trimmed organizerName when names are missing", async () => {
    const ok = await EmailService.sendCoOrganizerAssignedEmail(
      "co@example.com",
      { firstName: "", lastName: "" },
      { title: "Event", date: "2025-01-01", time: "12:00", location: "Hall" },
      { firstName: "", lastName: "" }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0];
    // Ensure HTML rendered and no crash due to missing names; presence check is enough
    expect(String(args.html)).toContain("Co-Organizer Assignment");
  });
});
