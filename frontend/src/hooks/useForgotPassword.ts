import { useState } from "react";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import type { ForgotPasswordFormData } from "../schemas/loginSchema";
import { authService } from "../services/api";
import {
  canSendPasswordReset,
  markPasswordResetSent,
  getRemainingCooldown,
  formatCooldownTime,
} from "../utils/emailValidationUtils";

export function useForgotPassword() {
  const notification = useToastReplacement();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);

    try {
      // Check cooldown period to prevent spam
      if (!canSendPasswordReset(data.email)) {
        const remainingTime = getRemainingCooldown(
          data.email,
          "password_reset"
        );
        notification.warning(
          `Please wait ${formatCooldownTime(
            remainingTime
          )} before requesting another password reset.`,
          {
            title: "Cooldown Period Active",
            autoCloseDelay: 5000,
          }
        );
        return false;
      }

      // Call the real backend API for password reset
      await authService.forgotPassword(data.email);

      // Mark email as sent for cooldown tracking
      markPasswordResetSent(data.email);

      notification.success(
        "If that email address is in our system, you will receive a password reset email shortly.",
        {
          title: "Reset Request Sent",
          autoCloseDelay: 6000,
        }
      );
      return true; // Return success status
    } catch (error: any) {
      console.error("Password recovery error:", error);

      // Extract error message from API response
      const errorMessage =
        error.message || "Failed to send recovery email. Please try again.";

      notification.error(errorMessage, {
        title: "Reset Request Failed",
      });
      return false; // Return failure status
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    handleForgotPassword,
  };
}
