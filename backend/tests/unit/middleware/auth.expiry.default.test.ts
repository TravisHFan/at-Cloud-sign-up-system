import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TokenService } from "../../../src/middleware/auth";

describe("TokenService default access token expiry", () => {
  const prev = process.env.JWT_ACCESS_EXPIRE;

  beforeEach(() => {
    delete process.env.JWT_ACCESS_EXPIRE; // Ensure default applies
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.JWT_ACCESS_EXPIRE;
    else process.env.JWT_ACCESS_EXPIRE = prev;
  });

  it("sets accessTokenExpires to ~12 hours from now by default", () => {
    const now = Date.now();
    const fakeUser: any = {
      _id: "507f1f77bcf86cd799439011",
      email: "user@example.com",
      role: "Participant",
    };

    const tokens = TokenService.generateTokenPair(fakeUser);
    const deltaMs = tokens.accessTokenExpires.getTime() - now;
    const twelveHours = 12 * 60 * 60 * 1000;
    const tolerance = 5 * 60 * 1000; // 5 minutes
    expect(deltaMs).toBeGreaterThan(twelveHours - tolerance);
    expect(deltaMs).toBeLessThan(twelveHours + tolerance);
  });
});
