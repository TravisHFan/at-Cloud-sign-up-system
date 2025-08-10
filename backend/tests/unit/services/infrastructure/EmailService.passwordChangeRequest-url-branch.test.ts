import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService.sendPasswordChangeRequestEmail FRONTEND_URL branches", () => {
  const originalEnv = { ...process.env } as NodeJS.ProcessEnv;
  let spy: any;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test"; // ensure sendEmail short-circuits; we only need constructed args
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses default localhost when FRONTEND_URL is not set", async () => {
    delete process.env.FRONTEND_URL;
    const ok = await EmailService.sendPasswordChangeRequestEmail(
      "user@example.com",
      "User",
      "confirm-token-123"
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain(
      "http://localhost:5173/change-password/confirm/confirm-token-123"
    );
  });

  it("uses provided FRONTEND_URL when set", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const ok = await EmailService.sendPasswordChangeRequestEmail(
      "user@example.com",
      "User",
      "confirm-token-xyz"
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain(
      "https://app.example.com/change-password/confirm/confirm-token-xyz"
    );
  });
});
