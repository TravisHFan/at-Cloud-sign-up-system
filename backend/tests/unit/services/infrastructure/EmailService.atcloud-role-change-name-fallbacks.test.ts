import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../../../../src/services/infrastructure/emailService";

describe("EmailService AtCloud role-change name fallbacks", () => {
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

  it("user email trims and handles missing first/last names", async () => {
    const ok = await EmailService.sendAtCloudRoleChangeToUser("u@example.com", {
      _id: "1",
      firstName: "",
      lastName: "",
      email: "u@example.com",
      oldRoleInAtCloud: "Member",
      newRoleInAtCloud: "Leader",
    } as any);
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    // Greeting uses trimmed name; ensure no double spaces or 'undefined'
    const greet = String(args.html).match(/<h2>Hello[\s\S]*?<\/h2>/)?.[0] ?? "";
    expect(greet).not.toMatch(/undefined/);
    expect(greet).not.toMatch(/ {2,}/);
  });

  it("admins email uses provided adminName and formats user name from blanks", async () => {
    const ok = await EmailService.sendAtCloudRoleChangeToAdmins(
      "admin@example.com",
      "Admin A",
      {
        _id: "2",
        firstName: "",
        lastName: "",
        email: "u2@example.com",
        oldRoleInAtCloud: "Leader",
        newRoleInAtCloud: "Member",
      } as any
    );
    expect(ok).toBe(true);
    const args = spy.mock.calls[0][0] as any;
    expect(String(args.subject)).toContain(
      "Admin Alert: Ministry Role Change -"
    );
    // User Details section should show empty Name gracefully (not 'undefined')
    const details =
      String(args.html).match(
        /<div class="user-details">[\s\s\S]*?<\/div>/
      )?.[0] ?? "";
    expect(details).not.toMatch(/undefined/);
  });
});
