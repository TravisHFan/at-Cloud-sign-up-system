import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendDemotionNotificationToUser FRONTEND_URL branches", () => {
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

  const user = {
    firstName: "Demo",
    lastName: "Ted",
    email: "demo@example.com",
    oldRole: "Administrator",
    newRole: "Member",
  } as any;
  const changedBy = {
    firstName: "Ops",
    lastName: "Admin",
    email: "ops@example.com",
    role: "Administrator",
  };

  it("uses default localhost URL when FRONTEND_URL is not set (user demotion)", async () => {
    delete process.env.FRONTEND_URL;
    const ok = await EmailService.sendDemotionNotificationToUser(
      user.email,
      user,
      changedBy,
      "Routine adjustment"
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("http://localhost:5173/dashboard");
    expect(String(args.text)).toContain("http://localhost:5173/dashboard");
  });

  it("uses custom FRONTEND_URL when set (user demotion)", async () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const ok = await EmailService.sendDemotionNotificationToUser(
      user.email,
      user,
      changedBy
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.html)).toContain("https://app.example.com/dashboard");
    expect(String(args.text)).toContain("https://app.example.com/dashboard");
  });
});
