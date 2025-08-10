import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService event/welcome FRONTEND_URL branches", () => {
  let spy: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService as any, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("sendEventNotificationEmail uses default localhost dashboard when FRONTEND_URL missing", async () => {
    delete process.env.FRONTEND_URL;
    const ok = await (EmailService as any).sendEventNotificationEmail(
      "u@example.com",
      "User",
      { eventTitle: "E1", eventDate: "2025-01-01", message: "Hi" }
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("http://localhost:5173/dashboard");
  });

  it("sendWelcomeEmail uses custom FRONTEND_URL when set", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const ok = await (EmailService as any).sendWelcomeEmail(
      "u@example.com",
      "User"
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("https://app.example.com/dashboard");
    expect(String(args.text)).toContain("https://app.example.com/dashboard");
  });
});
