import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

// Covers fallback branches where first/last names may be missing ("" fallback and trim)
describe("EmailService.sendDemotionNotificationToUser - name fallbacks", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("handles missing names gracefully and still sends email payload", async () => {
    const spy = vi
      .spyOn(EmailService as any, "sendEmail")
      .mockResolvedValue(true);
    const ok = await EmailService.sendDemotionNotificationToUser(
      "recipient@example.com",
      {
        firstName: "",
        lastName: "",
        email: "recipient@example.com",
        oldRole: "Administrator",
        newRole: "Leader",
      } as any,
      {
        firstName: "",
        lastName: "",
        email: "changer@example.com",
        role: "Administrator",
      } as any,
      undefined
    );

    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const args = spy.mock.calls[0][0] as any;
    // HTML should still render primary sections and dashboard button regardless of names
    expect(String(args.html)).toContain("Access Your Dashboard");
    // Text version includes dashboard URL
    expect(String(args.text)).toContain("/dashboard");
  });
});
