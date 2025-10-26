import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/EmailServiceFacade";

// Targets the specific Medium mapping path: Leader -> Participant
// Uses test env short-circuit and spies to validate generated email payload.
describe("EmailService.sendDemotionNotificationToAdmins - Medium (Leader -> Participant)", () => {
  const originalEnv = { ...process.env } as NodeJS.ProcessEnv;
  let spy: any;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
    spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("renders Medium description and omits Security Review button", async () => {
    const ok = await EmailService.sendDemotionNotificationToAdmins(
      "alerts@example.com",
      "Ops Team",
      {
        _id: "u-med",
        firstName: "Liam",
        lastName: "Lead",
        email: "liam.lead@example.com",
        oldRole: "Leader",
        newRole: "Participant",
      },
      {
        firstName: "Ava",
        lastName: "Admin",
        email: "ava.admin@example.com",
        role: "Administrator",
      },
      undefined
    );

    expect(ok).toBe(true);
    const [payload] = spy.mock.calls[0];
    const html = String(payload.html);
    expect(html).toContain(
      "Moderate role adjustment within operational levels"
    );
    expect(html).toContain(
      "Update access permissions, notify relevant teams, provide role transition guidance"
    );
    expect(html).not.toContain("/admin/security-review");
  });
});
