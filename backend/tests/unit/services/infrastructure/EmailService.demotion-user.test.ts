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

describe("EmailService demotion-to-user coverage", () => {
  const prevEnv = { ...process.env } as NodeJS.ProcessEnv;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.FRONTEND_URL = "http://localhost:5173";
  });

  afterAll(() => {
    process.env = prevEnv;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (EmailService as any).transporter = undefined;
  });

  const userData = {
    firstName: "Jane",
    lastName: "Doe",
    oldRole: "Leader",
    newRole: "Participant",
    email: "jane@example.com",
  } as const;

  const changedBy = {
    firstName: "Admin",
    lastName: "User",
    role: "Administrator",
    email: "admin@example.com",
  } as const;

  it("includes Context when reason is provided", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);

    const ok = await EmailService.sendDemotionNotificationToUser(
      userData.email,
      userData as any,
      changedBy as any,
      "policy update"
    );

    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const [payload] = spy.mock.calls[0];
    expect(String(payload.subject)).toBe(
      "Ministry Role Update - Your Position in @Cloud Ministry"
    );
    expect(String(payload.text)).toContain(
      `Your role in @Cloud Ministry has been updated from ${userData.oldRole} to ${userData.newRole}`
    );
    expect(String(payload.text)).toContain("Context: policy update");
  });

  it("omits Context when reason is absent", async () => {
    const spy = vi.spyOn(EmailService, "sendEmail").mockResolvedValue(true);

    const ok = await EmailService.sendDemotionNotificationToUser(
      userData.email,
      userData as any,
      changedBy as any
    );

    expect(ok).toBe(true);
    const [payload] = spy.mock.calls[0];
    expect(String(payload.text)).not.toContain("Context:");
  });
});
