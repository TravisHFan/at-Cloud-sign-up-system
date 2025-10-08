import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TokenService } from "../../../src/middleware/auth";

describe("TokenService - Dynamic Token Expiry Fix", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment to clean state
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const mockUser = {
    _id: "507f1f77bcf86cd799439011",
    email: "test@example.com",
    role: "Participant",
  } as any;

  describe("parseTimeToMs utility", () => {
    it("should parse seconds correctly", () => {
      process.env.JWT_ACCESS_EXPIRE = "3600"; // 1 hour in seconds
      const tokens = TokenService.generateTokenPair(mockUser);
      const actualDuration = tokens.accessTokenExpires.getTime() - Date.now();

      // Should be approximately 1 hour (3600s) minus 30s clock skew = 3570s = 3570000ms
      expect(actualDuration).toBeGreaterThan(3560000); // Allow 10s tolerance
      expect(actualDuration).toBeLessThan(3580000);
    });

    it("should parse minutes correctly", () => {
      process.env.JWT_ACCESS_EXPIRE = "15m";
      const tokens = TokenService.generateTokenPair(mockUser);
      const actualDuration = tokens.accessTokenExpires.getTime() - Date.now();

      // Should be approximately 15 minutes minus 30s clock skew = 870s = 870000ms
      expect(actualDuration).toBeGreaterThan(860000); // Allow 10s tolerance
      expect(actualDuration).toBeLessThan(880000);
    });

    it("should parse hours correctly", () => {
      process.env.JWT_ACCESS_EXPIRE = "2h";
      const tokens = TokenService.generateTokenPair(mockUser);
      const actualDuration = tokens.accessTokenExpires.getTime() - Date.now();

      // Should be approximately 2 hours minus 30s clock skew = 7170s = 7170000ms
      expect(actualDuration).toBeGreaterThan(7160000); // Allow 10s tolerance
      expect(actualDuration).toBeLessThan(7180000);
    });

    it("should parse days correctly", () => {
      process.env.JWT_REFRESH_EXPIRE = "14d";
      const tokens = TokenService.generateTokenPair(mockUser);
      const actualDuration = tokens.refreshTokenExpires.getTime() - Date.now();

      // Should be approximately 14 days = 1209600000ms
      expect(actualDuration).toBeGreaterThan(1209590000); // Allow 10s tolerance
      expect(actualDuration).toBeLessThan(1209610000);
    });

    it("should parse weeks correctly", () => {
      process.env.JWT_REFRESH_EXPIRE = "2w";
      const tokens = TokenService.generateTokenPair(mockUser);
      const actualDuration = tokens.refreshTokenExpires.getTime() - Date.now();

      // Should be approximately 2 weeks = 14 days = 1209600000ms
      expect(actualDuration).toBeGreaterThan(1209590000); // Allow 10s tolerance
      expect(actualDuration).toBeLessThan(1209610000);
    });
  });

  describe("Environment variable integration", () => {
    it("should use custom access token expiry from env var", () => {
      process.env.JWT_ACCESS_EXPIRE = "1h";
      process.env.JWT_REFRESH_EXPIRE = "7d";

      const tokens = TokenService.generateTokenPair(mockUser);
      const accessDuration = tokens.accessTokenExpires.getTime() - Date.now();
      const refreshDuration = tokens.refreshTokenExpires.getTime() - Date.now();

      // Access token: 1 hour minus 30s clock skew = 3570s
      expect(accessDuration).toBeGreaterThan(3560000);
      expect(accessDuration).toBeLessThan(3580000);

      // Refresh token: 7 days = 604800000ms
      expect(refreshDuration).toBeGreaterThan(604790000);
      expect(refreshDuration).toBeLessThan(604810000);
    });

    it("should use fallback defaults when env vars not set", () => {
      delete process.env.JWT_ACCESS_EXPIRE;
      delete process.env.JWT_REFRESH_EXPIRE;

      const tokens = TokenService.generateTokenPair(mockUser);
      const accessDuration = tokens.accessTokenExpires.getTime() - Date.now();
      const refreshDuration = tokens.refreshTokenExpires.getTime() - Date.now();

      // Default access token: 3h minus 30s clock skew = 10770s = 10770000ms
      expect(accessDuration).toBeGreaterThan(10760000);
      expect(accessDuration).toBeLessThan(10780000);

      // Default refresh token: 7d = 604800000ms
      expect(refreshDuration).toBeGreaterThan(604790000);
      expect(refreshDuration).toBeLessThan(604810000);
    });

    it("should apply clock skew only to access token", () => {
      process.env.JWT_ACCESS_EXPIRE = "1h";
      process.env.JWT_REFRESH_EXPIRE = "1h";

      const tokens = TokenService.generateTokenPair(mockUser);
      const accessDuration = tokens.accessTokenExpires.getTime() - Date.now();
      const refreshDuration = tokens.refreshTokenExpires.getTime() - Date.now();

      // Access token should be 30s shorter than refresh token due to clock skew
      expect(refreshDuration - accessDuration).toBeGreaterThan(25000); // ~30s difference
      expect(refreshDuration - accessDuration).toBeLessThan(35000);
    });
  });

  describe("Error handling", () => {
    it("should throw JWT library error for invalid time format", () => {
      process.env.JWT_ACCESS_EXPIRE = "invalid";

      expect(() => {
        TokenService.generateTokenPair(mockUser);
      }).toThrow(
        '"expiresIn" should be a number of seconds or string representing a timespan'
      );
    });

    it("should throw JWT library error for unsupported time unit", () => {
      process.env.JWT_ACCESS_EXPIRE = "5z"; // 'z' is not a valid unit

      expect(() => {
        TokenService.generateTokenPair(mockUser);
      }).toThrow(
        '"expiresIn" should be a number of seconds or string representing a timespan'
      );
    });
  });
  describe("Real-world scenarios", () => {
    it("should handle development settings", () => {
      process.env.JWT_ACCESS_EXPIRE = "8h";
      process.env.JWT_REFRESH_EXPIRE = "30d";

      const tokens = TokenService.generateTokenPair(mockUser);
      const accessDuration = tokens.accessTokenExpires.getTime() - Date.now();
      const refreshDuration = tokens.refreshTokenExpires.getTime() - Date.now();

      // 8h minus 30s = 28770s = 28770000ms
      expect(accessDuration).toBeGreaterThan(28760000);
      expect(accessDuration).toBeLessThan(28780000);

      // 30d = 2592000000ms
      expect(refreshDuration).toBeGreaterThan(2591990000);
      expect(refreshDuration).toBeLessThan(2592010000);
    });

    it("should handle production settings", () => {
      process.env.JWT_ACCESS_EXPIRE = "15m";
      process.env.JWT_REFRESH_EXPIRE = "7d";

      const tokens = TokenService.generateTokenPair(mockUser);
      const accessDuration = tokens.accessTokenExpires.getTime() - Date.now();
      const refreshDuration = tokens.refreshTokenExpires.getTime() - Date.now();

      // 15m minus 30s = 870s = 870000ms
      expect(accessDuration).toBeGreaterThan(860000);
      expect(accessDuration).toBeLessThan(880000);

      // 7d = 604800000ms
      expect(refreshDuration).toBeGreaterThan(604790000);
      expect(refreshDuration).toBeLessThan(604810000);
    });
  });
});
