import jwt from "jsonwebtoken";

export interface RoleAssignmentRejectionTokenPayload {
  assignmentId: string;
  assigneeId: string;
  type: "roleRejection";
  exp: number; // seconds since epoch
}

const DEFAULT_EXP_DAYS = 14;

function getSecret(): string {
  const secret =
    process.env.ROLE_ASSIGNMENT_REJECTION_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "ROLE_ASSIGNMENT_REJECTION_SECRET or JWT_SECRET must be set for rejection tokens"
    );
  }
  return secret;
}

export function createRoleAssignmentRejectionToken(params: {
  assignmentId: string;
  assigneeId: string;
  expiresInDays?: number;
}): string {
  const { assignmentId, assigneeId, expiresInDays = DEFAULT_EXP_DAYS } = params;
  const expSeconds =
    Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const payload: RoleAssignmentRejectionTokenPayload = {
    assignmentId,
    assigneeId,
    type: "roleRejection",
    exp: expSeconds,
  };
  return jwt.sign(payload, getSecret());
}

export type VerificationResult =
  | { valid: true; payload: RoleAssignmentRejectionTokenPayload }
  | { valid: false; reason: "invalid" | "expired" | "wrong_type" };

export function verifyRoleAssignmentRejectionToken(
  token: string
): VerificationResult {
  try {
    const decoded = jwt.verify(
      token,
      getSecret()
    ) as RoleAssignmentRejectionTokenPayload;
    if (decoded.type !== "roleRejection") {
      return { valid: false, reason: "wrong_type" };
    }
    if (decoded.exp * 1000 < Date.now()) {
      return { valid: false, reason: "expired" };
    }
    return { valid: true, payload: decoded };
  } catch {
    return { valid: false, reason: "invalid" };
  }
}
