import jwt from "jsonwebtoken";

/**
 * Guest Invitation Decline Token
 * --------------------------------
 * Mirrors roleAssignmentRejectionToken pattern but for guest registrations.
 * Payload keeps minimal PII (only registrationId + type discriminator).
 * Expiry: default 14 days (same as user role decline flow) unless overridden.
 */

export interface GuestInvitationDeclineTokenPayload {
  registrationId: string; // GuestRegistration _id
  type: "guestInvitationDecline";
  exp: number; // seconds since epoch
}

const DEFAULT_EXP_DAYS = 14;

function getSecret(): string {
  const secret =
    process.env.GUEST_INVITATION_DECLINE_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "GUEST_INVITATION_DECLINE_SECRET or JWT_SECRET must be set for guest invitation decline tokens"
    );
  }
  return secret;
}

export function createGuestInvitationDeclineToken(params: {
  registrationId: string;
  expiresInDays?: number;
}): string {
  const { registrationId, expiresInDays = DEFAULT_EXP_DAYS } = params;
  const expSeconds =
    Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const payload: GuestInvitationDeclineTokenPayload = {
    registrationId,
    type: "guestInvitationDecline",
    exp: expSeconds,
  };
  return jwt.sign(payload, getSecret());
}

export type GuestDeclineVerificationResult =
  | { valid: true; payload: GuestInvitationDeclineTokenPayload }
  | { valid: false; reason: "invalid" | "expired" | "wrong_type" };

export function verifyGuestInvitationDeclineToken(
  token: string
): GuestDeclineVerificationResult {
  try {
    const decoded = jwt.verify(
      token,
      getSecret()
    ) as GuestInvitationDeclineTokenPayload;
    if (decoded.type !== "guestInvitationDecline") {
      return { valid: false, reason: "wrong_type" };
    }
    if (decoded.exp * 1000 < Date.now()) {
      return { valid: false, reason: "expired" };
    }
    return { valid: true, payload: decoded };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      (err as { name?: string }).name === "TokenExpiredError"
    ) {
      return { valid: false, reason: "expired" };
    }
    return { valid: false, reason: "invalid" };
  }
}
