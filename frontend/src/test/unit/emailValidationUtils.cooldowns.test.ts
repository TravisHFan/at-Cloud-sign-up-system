import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  canSendVerificationEmail,
  canSendPasswordReset,
  markVerificationEmailSent,
  markPasswordResetSent,
  getRemainingCooldown,
  formatCooldownTime,
} from "../../utils/emailValidationUtils";

// Contract:
// - mark*Sent records a timestamp, canSend* returns false immediately after
// - getRemainingCooldown returns > 0 then decreases over time and hits 0 after cooldown
// - formatCooldownTime returns Xm Ys or Zs strings

describe("emailValidationUtils cooldown behavior", () => {
  const email = "user@example.com";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    try {
      vi.clearAllTimers();
    } catch {}
    vi.useRealTimers();
  });

  it("verification cooldown prevents immediate resend and counts down", () => {
    // Initially allowed
    expect(canSendVerificationEmail(email)).toBe(true);
    // Mark sent and verify blocked
    markVerificationEmailSent(email);
    expect(canSendVerificationEmail(email)).toBe(false);

    // Immediately, remaining cooldown near full (5 minutes)
    let remaining = getRemainingCooldown(email, "verification");
    expect(remaining).toBeGreaterThanOrEqual(5 * 60 * 1000 - 5); // allow tiny arithmetic epsilon

    // Advance 5 minutes (+epsilon) => cooldown cleared (logic uses strict ">" comparison)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    remaining = getRemainingCooldown(email, "verification");
    expect(remaining).toBe(0);
    expect(canSendVerificationEmail(email)).toBe(true);
  });

  it("password reset cooldown behaves independently", () => {
    expect(canSendPasswordReset(email)).toBe(true);
    markPasswordResetSent(email);
    expect(canSendPasswordReset(email)).toBe(false);

    // Advance 1 minute: still blocked (cooldown is 2 minutes)
    vi.advanceTimersByTime(60 * 1000);
    expect(canSendPasswordReset(email)).toBe(false);

    // Advance another minute (+epsilon): now allowed (strict ">" comparison)
    vi.advanceTimersByTime(60 * 1000 + 1);
    expect(canSendPasswordReset(email)).toBe(true);
  });

  it("formatCooldownTime formats minutes and seconds", () => {
    expect(formatCooldownTime(30_000)).toBe("30s");
    expect(formatCooldownTime(65_000)).toBe("1m 5s");
  });
});
