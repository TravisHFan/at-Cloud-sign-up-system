import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TokenService } from "../../../src/middleware/auth";

describe("TokenService default access token expiry (3h policy)", () => {
  const prev = process.env.JWT_ACCESS_EXPIRE;

  beforeEach(() => {
    delete process.env.JWT_ACCESS_EXPIRE; // Ensure default applies
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.JWT_ACCESS_EXPIRE;
    else process.env.JWT_ACCESS_EXPIRE = prev;
  });

  it("sets accessTokenExpires to ~3 hours (minus 30s skew) from now by default", () => {
    const now = Date.now();
    const fakeUser: any = {
      _id: "507f1f77bcf86cd799439011",
      email: "user@example.com",
      role: "Participant",
    };

    const tokens = TokenService.generateTokenPair(fakeUser);
    const deltaMs = tokens.accessTokenExpires.getTime() - now;
    // New default: 3h (10800000 ms) minus 30s clock skew buffer applied in TokenService
    const expected = 3 * 60 * 60 * 1000 - 30 * 1000; // 10,770,000 ms
    const tolerance = 2 * 60 * 1000; // 2 minutes tolerance to avoid flakiness
    expect(deltaMs).toBeGreaterThan(expected - tolerance);
    expect(deltaMs).toBeLessThan(expected + tolerance);
  });
});
