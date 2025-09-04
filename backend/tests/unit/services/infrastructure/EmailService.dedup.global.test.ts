import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService - global dedup in sendEmail", () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("suppresses duplicate emails with identical to/subject/body within TTL", async () => {
    const unique = `Test-Subject-${Date.now()}`;

    // First send
    const ok1 = await EmailService.sendGenericNotificationEmail(
      "dup@example.com",
      "User X",
      {
        subject: unique,
        contentHtml: "<p>Hello world</p>",
        contentText: "Hello world",
      }
    );

    // Second send with identical payload should be suppressed by dedupe cache
    const ok2 = await EmailService.sendGenericNotificationEmail(
      "dup@example.com",
      "User X",
      {
        subject: unique,
        contentHtml: "<p>Hello world</p>",
        contentText: "Hello world",
      }
    );

    expect(ok1).toBe(true);
    expect(ok2).toBe(true);

    // Only the first call should have emitted the test-env skip log
    const skippedLogs = consoleSpy.mock.calls
      .map((c) => (c?.[0] as string) || "")
      .filter((m) => m.startsWith("📧 Email skipped in test environment:"));
    expect(skippedLogs.length).toBe(1);
  });
});
