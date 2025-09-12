import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

// We will spy on the generic sendEmail method to capture payload
vi.mock(
  "../../../../src/services/infrastructure/emailService",
  async (orig) => {
    const actual = await (orig as any)();
    return {
      EmailService: {
        ...actual.EmailService,
        sendEmail: vi.fn().mockResolvedValue(true),
      },
    };
  }
);

// Bring back the real class after mock for static method usage
// (We rely on the mocked sendEmail inside its implementation.)

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
    // Spy on sendEmail
    const sendSpy = (EmailService as any).sendEmail as ReturnType<typeof vi.fn>;
    // Act
    await EmailService.sendEventRoleAssignmentRejectedEmail(to, payload as any);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const args = sendSpy.mock.calls[0][0];
    // Assert snapshot of subject + presence of key phrases in html
    expect(args.subject).toBe(
      `❌ Assignment Rejected: Greeter - Community Gathering`
    );
    // Basic inline snapshot for HTML (stable minimal markers only)
    expect(args.html).toMatchInlineSnapshot(
      `"\n      <div style=\"font-family:Arial,sans-serif;line-height:1.5;font-size:14px;\">\n        <p><strong>Bob User</strong> has <strong>rejected</strong> the assignment for the role <strong>Greeter</strong> in event <em>Community Gathering</em>.</p>\n        <p>A rejection note was provided in the system.</p>\n        <p style=\"margin-top:16px;\">You can reassign this role or reach out to the user if more context is needed.</p>\n        <hr style=\"border:none;border-top:1px solid #eee;margin:24px 0;\"/>\n        <p style=\"font-size:12px;color:#666;\">This is an automated notification regarding role assignment rejection.</p>\n      </div>\n    "`
    );
  });
});
