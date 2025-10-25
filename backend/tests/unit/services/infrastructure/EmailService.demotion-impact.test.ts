import { EmailTransporter } from "../../../../src/services/email/EmailTransporter";
import {
  describe,
  it,
  beforeAll,
  afterAll,
  afterEach,
  expect,
  vi,
} from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService demotion impact levels", () => {
  const prevEnv = { ...process.env } as NodeJS.ProcessEnv;

  beforeAll(() => {
    process.env.NODE_ENV = "test"; // keep tests deterministic and side-effect free
    process.env.FRONTEND_URL = "http://localhost:5173";
  });

  afterAll(() => {
    process.env = prevEnv;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    EmailTransporter.resetTransporter();
  });

  const baseUser = {
    _id: "u1",
    firstName: "Test",
    lastName: "User",
    email: "user@example.com",
  } as const;

  const admin = {
    firstName: "Admin",
    lastName: "One",
    email: "admin@example.com",
    role: "Super Admin",
  } as const;

  const cases = [
    { from: "Super Admin", to: "Administrator", impact: "Critical" },
    { from: "Administrator", to: "Participant", impact: "High" },
    { from: "Leader", to: "Participant", impact: "Medium" },
    { from: "Administrator", to: "Leader", impact: "Medium" },
    // Promotion shape is treated as Standard in current implementation
    { from: "Leader", to: "Administrator", impact: "Standard" },
    { from: "Participant", to: "Participant", impact: "Standard" },
  ] as const;

  cases.forEach(({ from, to, impact }) => {
    it(`sends admin demotion alert with Impact: ${impact} for ${from} -> ${to}`, async () => {
      const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);
      const ok = await EmailService.sendDemotionNotificationToAdmins(
        "alerts@example.com",
        "Security Team",
        { ...baseUser, oldRole: from, newRole: to },
        admin,
        "policy update"
      );

      expect(ok).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      const [payload] = spy.mock.calls[0];
      expect(payload.to).toBe("alerts@example.com");
      expect(String(payload.subject)).toContain(
        `User Demoted from ${from} to ${to}`
      );
      // Text body includes the computed impact level
      expect(String(payload.text)).toContain(`Impact: ${impact}`);
    });
  });
});
