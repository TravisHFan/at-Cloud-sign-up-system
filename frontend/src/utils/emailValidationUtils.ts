// Email validation utilities for preventing duplicate sends and validation

const VERIFICATION_EMAIL_COOLDOWN = 5 * 60 * 1000; // 5 minutes in milliseconds
const PASSWORD_RESET_COOLDOWN = 2 * 60 * 1000; // 2 minutes in milliseconds

// Track recent email sends to prevent spam
const recentEmailSends = new Map<string, { timestamp: number; type: string }>();

export const canSendVerificationEmail = (email: string): boolean => {
  const lastSend = recentEmailSends.get(`verification_${email}`);
  if (!lastSend) return true;

  const timeSince = Date.now() - lastSend.timestamp;
  return timeSince > VERIFICATION_EMAIL_COOLDOWN;
};

export const canSendPasswordReset = (email: string): boolean => {
  const lastSend = recentEmailSends.get(`password_reset_${email}`);
  if (!lastSend) return true;

  const timeSince = Date.now() - lastSend.timestamp;
  return timeSince > PASSWORD_RESET_COOLDOWN;
};

export const markVerificationEmailSent = (email: string): void => {
  recentEmailSends.set(`verification_${email}`, {
    timestamp: Date.now(),
    type: "verification",
  });
};

export const markPasswordResetSent = (email: string): void => {
  recentEmailSends.set(`password_reset_${email}`, {
    timestamp: Date.now(),
    type: "password_reset",
  });
};

export const getRemainingCooldown = (
  email: string,
  type: "verification" | "password_reset"
): number => {
  const lastSend = recentEmailSends.get(`${type}_${email}`);
  if (!lastSend) return 0;

  const cooldown =
    type === "verification"
      ? VERIFICATION_EMAIL_COOLDOWN
      : PASSWORD_RESET_COOLDOWN;
  const timeSince = Date.now() - lastSend.timestamp;
  return Math.max(0, cooldown - timeSince);
};

export const formatCooldownTime = (milliseconds: number): string => {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};
