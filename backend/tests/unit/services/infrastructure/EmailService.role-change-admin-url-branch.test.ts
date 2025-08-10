import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService role change FRONTEND_URL branches", () => {
  let spy: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses default localhost URL when FRONTEND_URL is not set", async () => {
    delete process.env.FRONTEND_URL;
    const ok = await EmailService.sendAtCloudRoleChangeToUser("u@example.com", {
      _id: "1",
      firstName: "A",
      lastName: "B",
      email: "u@example.com",
      oldRoleInAtCloud: "Member",
      newRoleInAtCloud: "Leader",
    } as any);
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain(
      "http://localhost:5173/ministry/dashboard"
    );
    expect(String(args.text)).toContain(
      "http://localhost:5173/ministry/dashboard"
    );
  });

  it("uses custom FRONTEND_URL when set", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const ok = await EmailService.sendAtCloudRoleChangeToUser("u@example.com", {
      _id: "1",
      firstName: "A",
      lastName: "B",
      email: "u@example.com",
      oldRoleInAtCloud: "Member",
      newRoleInAtCloud: "Leader",
    } as any);
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain(
      "https://app.example.com/ministry/dashboard"
    );
    expect(String(args.text)).toContain(
      "https://app.example.com/ministry/dashboard"
    );
  });
});
