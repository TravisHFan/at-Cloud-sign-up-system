import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import {
  createRoleAssignmentRejectionToken,
  verifyRoleAssignmentRejectionToken,
  RoleAssignmentRejectionTokenPayload,
} from "../../../src/utils/roleAssignmentRejectionToken";

// Provide secret for tests
process.env.ROLE_ASSIGNMENT_REJECTION_SECRET = "test-secret";

describe("roleAssignmentRejectionToken utility", () => {
  it("creates a valid token that verifies", () => {
    const token = createRoleAssignmentRejectionToken({
      assignmentId: "507f1f77bcf86cd799439011",
      assigneeId: "507f1f77bcf86cd799439012",
      expiresInDays: 1,
    });
    const result = verifyRoleAssignmentRejectionToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.assignmentId).toBe("507f1f77bcf86cd799439011");
      expect(result.payload.assigneeId).toBe("507f1f77bcf86cd799439012");
      expect(result.payload.type).toBe("roleRejection");
      expect(result.payload.exp * 1000).toBeGreaterThan(Date.now());
    }
  });

  it("uses default expiration when expiresInDays not provided", () => {
    const token = createRoleAssignmentRejectionToken({
      assignmentId: "507f1f77bcf86cd799439011",
      assigneeId: "507f1f77bcf86cd799439012",
    });
    const result = verifyRoleAssignmentRejectionToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      // Default is 14 days - token should expire approximately 14 days from now
      const expectedMinExp = Date.now() + 14 * 24 * 60 * 60 * 1000 - 60000; // -1 min buffer
      const expectedMaxExp = Date.now() + 14 * 24 * 60 * 60 * 1000 + 60000; // +1 min buffer
      expect(result.payload.exp * 1000).toBeGreaterThanOrEqual(expectedMinExp);
      expect(result.payload.exp * 1000).toBeLessThanOrEqual(expectedMaxExp);
    }
  });

  it("detects expired token", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 10;
    const payload: RoleAssignmentRejectionTokenPayload = {
      assignmentId: "a1",
      assigneeId: "b2",
      type: "roleRejection",
      exp: pastExp,
    };
    const token = jwt.sign(
      payload,
      process.env.ROLE_ASSIGNMENT_REJECTION_SECRET!
    );
    const result = verifyRoleAssignmentRejectionToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("expired");
    }
  });

  it("detects token that has just expired using payload.exp check", () => {
    // Create a token that passes jwt.verify (ignoreExpiration style) but fails our manual check
    // We need to mock Date.now to simulate a token that was valid when created but is now expired
    const now = Date.now();
    const pastExp = Math.floor(now / 1000) - 1; // Just expired by 1 second
    const payload: RoleAssignmentRejectionTokenPayload = {
      assignmentId: "a1",
      assigneeId: "b2",
      type: "roleRejection",
      exp: pastExp,
    };
    // Sign without expiration validation to simulate jwt.verify passing
    const token = jwt.sign(
      payload,
      process.env.ROLE_ASSIGNMENT_REJECTION_SECRET!
    );
    const result = verifyRoleAssignmentRejectionToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("expired");
    }
  });

  it("detects wrong type", () => {
    const exp = Math.floor(Date.now() / 1000) + 1000;
    const token = jwt.sign(
      { assignmentId: "a", assigneeId: "b", type: "other", exp },
      process.env.ROLE_ASSIGNMENT_REJECTION_SECRET!
    );
    const result = verifyRoleAssignmentRejectionToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("wrong_type");
    }
  });

  it("detects invalid token", () => {
    const result = verifyRoleAssignmentRejectionToken("not-a-token");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("detects token signed with wrong secret", () => {
    const exp = Math.floor(Date.now() / 1000) + 1000;
    const token = jwt.sign(
      { assignmentId: "a", assigneeId: "b", type: "roleRejection", exp },
      "wrong-secret"
    );
    const result = verifyRoleAssignmentRejectionToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("falls back to JWT_SECRET when ROLE_ASSIGNMENT_REJECTION_SECRET not set", () => {
    const originalRejectionSecret =
      process.env.ROLE_ASSIGNMENT_REJECTION_SECRET;
    delete process.env.ROLE_ASSIGNMENT_REJECTION_SECRET;
    process.env.JWT_SECRET = "fallback-jwt-secret";

    // Create token using fallback secret
    const token = createRoleAssignmentRejectionToken({
      assignmentId: "507f1f77bcf86cd799439011",
      assigneeId: "507f1f77bcf86cd799439012",
      expiresInDays: 1,
    });

    // Verify using fallback secret
    const result = verifyRoleAssignmentRejectionToken(token);
    expect(result.valid).toBe(true);

    // Restore
    process.env.ROLE_ASSIGNMENT_REJECTION_SECRET = originalRejectionSecret;
  });

  it("throws when neither ROLE_ASSIGNMENT_REJECTION_SECRET nor JWT_SECRET is set", () => {
    const originalRejectionSecret =
      process.env.ROLE_ASSIGNMENT_REJECTION_SECRET;
    const originalJwtSecret = process.env.JWT_SECRET;
    delete process.env.ROLE_ASSIGNMENT_REJECTION_SECRET;
    delete process.env.JWT_SECRET;

    try {
      expect(() =>
        createRoleAssignmentRejectionToken({
          assignmentId: "507f1f77bcf86cd799439011",
          assigneeId: "507f1f77bcf86cd799439012",
        })
      ).toThrow(
        "ROLE_ASSIGNMENT_REJECTION_SECRET or JWT_SECRET must be set for rejection tokens"
      );
    } finally {
      // Restore
      process.env.ROLE_ASSIGNMENT_REJECTION_SECRET = originalRejectionSecret;
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });
});
