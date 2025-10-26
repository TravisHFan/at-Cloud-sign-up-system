import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendEventCreatedEmail branches", () => {
  let spy: any;
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseEvent = {
    title: "Training",
    date: "2025-12-31",
    time: "10:00",
    endTime: "12:00",
    location: "Main Hall",
    organizer: "Alice",
    purpose: "Equip",
    format: "Online",
  } as any;

  it("includes zoom join link section when zoomLink is provided", async () => {
    await EmailService.sendEventCreatedEmail("u@example.com", "User", {
      ...baseEvent,
      zoomLink: "https://zoom.us/j/room",
    });
    const args = spy.mock.calls[0][0] as any;
    expect(args.subject).toContain("Training");
    expect(args.html).toContain("Join Link");
    expect(args.html).toContain("https://zoom.us/j/room");
  });

  it("omits join link section when no zoomLink present", async () => {
    await EmailService.sendEventCreatedEmail("u@example.com", "User", {
      ...baseEvent,
      format: "In-person",
    });
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).not.toMatch(/Join Link/);
    expect(args.html).toContain("Format:");
  });
});
