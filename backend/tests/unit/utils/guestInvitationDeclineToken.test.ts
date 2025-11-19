import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import {
  createGuestInvitationDeclineToken,
  verifyGuestInvitationDeclineToken,
  type GuestInvitationDeclineTokenPayload,
} from "../../../src/utils/guestInvitationDeclineToken";

describe("guestInvitationDeclineToken", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.GUEST_INVITATION_DECLINE_SECRET = "test-secret-12345";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createGuestInvitationDeclineToken", () => {
    it("should create valid token with required fields", () => {
      const token = createGuestInvitationDeclineToken({
        registrationId: "reg123",
      });

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");

      // Decode without verification to check structure
      const decoded = jwt.decode(token) as GuestInvitationDeclineTokenPayload;
      expect(decoded.registrationId).toBe("reg123");
      expect(decoded.type).toBe("guestInvitationDecline");
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it("should use default expiry of 14 days", () => {
      const beforeCreate = Math.floor(Date.now() / 1000);
      const token = createGuestInvitationDeclineToken({
        registrationId: "reg123",
      });
      const afterCreate = Math.floor(Date.now() / 1000);

      const decoded = jwt.decode(token) as GuestInvitationDeclineTokenPayload;
      const expectedMinExp = beforeCreate + 14 * 24 * 60 * 60;
      const expectedMaxExp = afterCreate + 14 * 24 * 60 * 60;

      expect(decoded.exp).toBeGreaterThanOrEqual(expectedMinExp);
      expect(decoded.exp).toBeLessThanOrEqual(expectedMaxExp);
    });

    it("should accept custom expiry in days", () => {
      const beforeCreate = Math.floor(Date.now() / 1000);
      const token = createGuestInvitationDeclineToken({
        registrationId: "reg456",
        expiresInDays: 7,
      });

      const decoded = jwt.decode(token) as GuestInvitationDeclineTokenPayload;
      const expectedExp = beforeCreate + 7 * 24 * 60 * 60;

      expect(decoded.exp).toBeCloseTo(expectedExp, -1); // Within 10 seconds
    });

    it("should handle very short expiry", () => {
      const token = createGuestInvitationDeclineToken({
        registrationId: "reg789",
        expiresInDays: 1,
      });

      const decoded = jwt.decode(token) as GuestInvitationDeclineTokenPayload;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const oneDayFromNow = nowSeconds + 24 * 60 * 60;

      expect(decoded.exp).toBeCloseTo(oneDayFromNow, -1);
    });

    it("should handle long expiry", () => {
      const token = createGuestInvitationDeclineToken({
        registrationId: "reg999",
        expiresInDays: 90,
      });

      const decoded = jwt.decode(token) as GuestInvitationDeclineTokenPayload;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ninetyDaysFromNow = nowSeconds + 90 * 24 * 60 * 60;

      expect(decoded.exp).toBeCloseTo(ninetyDaysFromNow, -1);
    });

    it("should use GUEST_INVITATION_DECLINE_SECRET when available", () => {
      process.env.GUEST_INVITATION_DECLINE_SECRET = "specific-secret";
      process.env.JWT_SECRET = "fallback-secret";

      const token = createGuestInvitationDeclineToken({
        registrationId: "reg123",
      });

      // Should be able to verify with specific secret
      const decoded = jwt.verify(token, "specific-secret");
      expect(decoded).toBeTruthy();

      // Should NOT verify with fallback secret
      expect(() => jwt.verify(token, "fallback-secret")).toThrow();
    });

    it("should fallback to ROLE_ASSIGNMENT_REJECTION_SECRET", () => {
      delete process.env.GUEST_INVITATION_DECLINE_SECRET;
      process.env.ROLE_ASSIGNMENT_REJECTION_SECRET = "role-secret";
      process.env.JWT_SECRET = "jwt-secret";

      const token = createGuestInvitationDeclineToken({
        registrationId: "reg123",
      });

      const decoded = jwt.verify(token, "role-secret");
      expect(decoded).toBeTruthy();
    });

    it("should fallback to JWT_SECRET", () => {
      delete process.env.GUEST_INVITATION_DECLINE_SECRET;
      delete process.env.ROLE_ASSIGNMENT_REJECTION_SECRET;
      process.env.JWT_SECRET = "jwt-secret";

      const token = createGuestInvitationDeclineToken({
        registrationId: "reg123",
      });

      const decoded = jwt.verify(token, "jwt-secret");
      expect(decoded).toBeTruthy();
    });

    it("should fallback to JWT_ACCESS_SECRET", () => {
      delete process.env.GUEST_INVITATION_DECLINE_SECRET;
      delete process.env.ROLE_ASSIGNMENT_REJECTION_SECRET;
      delete process.env.JWT_SECRET;
      process.env.JWT_ACCESS_SECRET = "access-secret";

      const token = createGuestInvitationDeclineToken({
        registrationId: "reg123",
      });

      const decoded = jwt.verify(token, "access-secret");
      expect(decoded).toBeTruthy();
    });

    it("should throw error when no secret available", () => {
      delete process.env.GUEST_INVITATION_DECLINE_SECRET;
      delete process.env.ROLE_ASSIGNMENT_REJECTION_SECRET;
      delete process.env.JWT_SECRET;
      delete process.env.JWT_ACCESS_SECRET;

      expect(() =>
        createGuestInvitationDeclineToken({ registrationId: "reg123" })
      ).toThrow(/Missing secret/);
    });
  });

  describe("verifyGuestInvitationDeclineToken", () => {
    it("should verify valid token successfully", () => {
      const token = createGuestInvitationDeclineToken({
        registrationId: "reg123",
        expiresInDays: 7,
      });

      const result = verifyGuestInvitationDeclineToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.registrationId).toBe("reg123");
        expect(result.payload.type).toBe("guestInvitationDecline");
        expect(result.payload.exp).toBeGreaterThan(Date.now() / 1000);
      }
    });

    it("should reject token with wrong type", () => {
      const wrongTypePayload = {
        registrationId: "reg123",
        type: "wrongType",
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = jwt.sign(
        wrongTypePayload,
        process.env.GUEST_INVITATION_DECLINE_SECRET!
      );

      const result = verifyGuestInvitationDeclineToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("wrong_type");
      }
    });

    it("should reject expired token (manual exp check)", () => {
      const expiredPayload: GuestInvitationDeclineTokenPayload = {
        registrationId: "reg456",
        type: "guestInvitationDecline",
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      const token = jwt.sign(
        expiredPayload,
        process.env.GUEST_INVITATION_DECLINE_SECRET!,
        { noTimestamp: true }
      );

      const result = verifyGuestInvitationDeclineToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("expired");
      }
    });

    it("should reject token expired via JWT verification", () => {
      // Create token that's already expired from JWT's perspective
      const token = jwt.sign(
        {
          registrationId: "reg789",
          type: "guestInvitationDecline",
        },
        process.env.GUEST_INVITATION_DECLINE_SECRET!,
        { expiresIn: "-1h" } // Already expired
      );

      const result = verifyGuestInvitationDeclineToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("expired");
      }
    });

    it("should reject token with invalid signature", () => {
      const token = createGuestInvitationDeclineToken({
        registrationId: "reg123",
      });

      // Tamper with token
      const tamperedToken = token.slice(0, -10) + "tampered00";

      const result = verifyGuestInvitationDeclineToken(tamperedToken);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("invalid");
      }
    });

    it("should reject malformed token", () => {
      const result = verifyGuestInvitationDeclineToken("not.a.valid.jwt");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("invalid");
      }
    });

    it("should reject completely invalid string", () => {
      const result = verifyGuestInvitationDeclineToken("random-string");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("invalid");
      }
    });

    it("should reject empty token", () => {
      const result = verifyGuestInvitationDeclineToken("");

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("invalid");
      }
    });

    it("should handle token signed with different secret", () => {
      const token = jwt.sign(
        {
          registrationId: "reg123",
          type: "guestInvitationDecline",
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        "different-secret"
      );

      const result = verifyGuestInvitationDeclineToken(token);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("invalid");
      }
    });

    it("should accept token that expires exactly now", () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const payload: GuestInvitationDeclineTokenPayload = {
        registrationId: "reg999",
        type: "guestInvitationDecline",
        exp: nowSeconds + 1, // Expires 1 second from now
      };
      const token = jwt.sign(
        payload,
        process.env.GUEST_INVITATION_DECLINE_SECRET!,
        { noTimestamp: true }
      );

      const result = verifyGuestInvitationDeclineToken(token);

      // Should be valid since it hasn't expired yet
      expect(result.valid).toBe(true);
    });
  });

  describe("integration: create and verify flow", () => {
    it("should create and verify token successfully", () => {
      const registrationId = "integration-test-123";

      const token = createGuestInvitationDeclineToken({
        registrationId,
        expiresInDays: 14,
      });

      const result = verifyGuestInvitationDeclineToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.registrationId).toBe(registrationId);
        expect(result.payload.type).toBe("guestInvitationDecline");
      }
    });

    it("should handle multiple tokens with different registration IDs", () => {
      const token1 = createGuestInvitationDeclineToken({
        registrationId: "reg-aaa",
      });
      const token2 = createGuestInvitationDeclineToken({
        registrationId: "reg-bbb",
      });

      const result1 = verifyGuestInvitationDeclineToken(token1);
      const result2 = verifyGuestInvitationDeclineToken(token2);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      if (result1.valid && result2.valid) {
        expect(result1.payload.registrationId).toBe("reg-aaa");
        expect(result2.payload.registrationId).toBe("reg-bbb");
      }
    });

    it("should maintain token validity across multiple verifications", () => {
      const token = createGuestInvitationDeclineToken({
        registrationId: "persistent-reg",
        expiresInDays: 30,
      });

      // Verify multiple times
      for (let i = 0; i < 5; i++) {
        const result = verifyGuestInvitationDeclineToken(token);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.payload.registrationId).toBe("persistent-reg");
        }
      }
    });
  });
});
