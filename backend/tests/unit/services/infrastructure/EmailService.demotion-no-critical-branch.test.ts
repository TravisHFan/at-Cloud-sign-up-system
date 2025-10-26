import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendDemotionNotificationToAdmins non-critical branch", () => {
  let spy: any;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("omits Security Review button when impact is not Critical (e.g., Admin -> Member)", async () => {
    const adminEmail = "admin@example.com";
    const adminName = "Admin";
    const user = {
      firstName: "Regular",
      lastName: "User",
      email: "regular@example.com",
      oldRole: "Administrator",
      newRole: "Member",
    } as any;
    const changedBy = {
      firstName: "Ops",
      lastName: "Admin",
      email: "ops@example.com",
      role: "Administrator",
    };

    const ok = await EmailService.sendDemotionNotificationToAdmins(
      adminEmail,
      adminName,
      user,
      changedBy,
      // include a reason; the branch we care about is the Critical vs non-Critical button
      "Routine adjustment"
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(args.subject).toContain("User Demoted");
    expect(String(args.html)).not.toContain("Security Review");
  });
});
