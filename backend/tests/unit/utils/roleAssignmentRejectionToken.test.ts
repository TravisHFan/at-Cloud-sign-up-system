import { describe, it, expect } from "vitest";
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
});
