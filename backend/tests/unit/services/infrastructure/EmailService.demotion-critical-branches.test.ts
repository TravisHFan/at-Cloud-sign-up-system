import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

describe("EmailService.sendDemotionNotificationToAdmins critical branches", () => {
  let spy: any;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const adminEmail = "admin@example.com";
  const adminName = "Admin";

  const baseUser = {
    firstName: "Super",
    lastName: "User",
    email: "su@example.com",
    oldRole: "Super Admin",
    newRole: "Administrator",
  } as any;
  const changedBy = {
    firstName: "Ops",
    lastName: "Admin",
    email: "ops@example.com",
    role: "Administrator",
  };

  it("includes Security Review button when impact is Critical (Super Admin demoted)", async () => {
    await EmailService.sendDemotionNotificationToAdmins(
      adminEmail,
      adminName,
      baseUser,
      changedBy,
      "Policy violation"
    );
    const args = spy.mock.calls[0][0] as any;
    expect(args.subject).toContain("User Demoted");
    expect(args.html).toContain("Security Review");
    // reason-dependent list item appears when reason provided (HTML bold within list item)
    expect(args.html).toMatch(
      /<li><strong>Communication:<\/strong> Ensure user has received appropriate guidance<\/li>/
    );
  });

  it("omits reason-specific list item when no reason provided", async () => {
    await EmailService.sendDemotionNotificationToAdmins(
      adminEmail,
      adminName,
      baseUser,
      changedBy
    );
    const args = spy.mock.calls[0][0] as any;
    // No 'Communication' oversight item when reason absent
    expect(String(args.html)).not.toMatch(
      /<li><strong>Communication:<\/strong> Ensure user has received appropriate guidance<\/li>/
    );
  });
});
