import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// NOTE: Previously this test replaced the whole module via vi.mock and spread the
// class into a plain object, which dropped non-enumerable static methods like
// sendEventRoleAssignmentRejectedEmail, causing a TypeError. We now simply spy
// on the static sendEmail method so all other static methods remain intact.

describe("EmailService.sendEventRoleAssignmentRejectedEmail snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures HTML structure (basic snapshot)", async () => {
    // Arrange
    const to = "assigner@example.com";
    const payload = {
      event: { id: "evt1", title: "Community Gathering" },
      roleName: "Greeter",
      rejectedBy: { firstName: "Bob", lastName: "User" },
      assigner: { firstName: "Alice", lastName: "Admin" },
      noteProvided: true,
    };
    // Spy on sendEmail (preserve implementation replacement only for return value)
    const sendSpy = vi
      .spyOn(EmailService as any, "sendEmail")
      .mockResolvedValue(true);
    // Act
    await EmailService.sendEventRoleAssignmentRejectedEmail(to, payload as any);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const args = sendSpy.mock.calls[0][0] as any; // cast for test assertion convenience
    // Assert snapshot of subject + presence of key phrases in html
    expect(args.subject).toBe(
      `❌ Invitation Declined: Greeter - Community Gathering`
    );
    // Basic inline snapshot for HTML (stable minimal markers only)
    expect(args.html).toMatchInlineSnapshot(
      `"\n      <div style=\"font-family:Arial,sans-serif;line-height:1.5;font-size:14px;\">\n        <p><strong>Bob User</strong> has <strong>declined</strong> the invitation for the role <strong>Greeter</strong> in event <em>Community Gathering</em>.</p>\n        <p>A rejection note was provided in the system.</p>\n        <p style=\"margin-top:16px;\">You can reassign this role or reach out to the user if more context is needed.</p>\n        <hr style=\"border:none;border-top:1px solid #eee;margin:24px 0;\"/>\n        <p style=\"font-size:12px;color:#666;\">This is an automated notification regarding role invitation decline.</p>\n      </div>\n    "`
    );
  });
});
