import { useState } from "react";
import toast from "react-hot-toast";
import type { ForgotPasswordFormData } from "../schemas/loginSchema";
import { emailNotificationService } from "../utils/emailNotificationService";
import { findUserByEmail } from "../data/mockUserData";
import {
  canSendPasswordReset,
  markPasswordResetSent,
  getRemainingCooldown,
  formatCooldownTime,
} from "../utils/emailValidationUtils";

export function useForgotPassword() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);

    try {
      // Check if user exists in the system
      const user = findUserByEmail(data.email);
      if (!user) {
        toast.error("No account found with this email address.");
        return false;
      }

      // Check cooldown period to prevent spam
      if (!canSendPasswordReset(data.email)) {
        const remainingTime = getRemainingCooldown(
          data.email,
          "password_reset"
        );
        toast.error(
          `Please wait ${formatCooldownTime(
            remainingTime
          )} before requesting another password reset.`
        );
        return false;
      }

      // Generate a temporary reset token for demo purposes
      const resetToken =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

      // Send password reset email using our notification service with actual user data
      await emailNotificationService.sendPasswordResetNotification(
        data.email,
        resetToken,
        user.firstName // Use actual user's first name
      );

      // Note: System message for password reset will be created server-side
      // when the password reset is processed by the backend
      console.log("Password reset processed for user:", user.id);

      // Mark email as sent for cooldown tracking
      markPasswordResetSent(data.email);

      toast.success("Password recovery email sent! Please check your inbox.");
      return true; // Return success status
    } catch (error) {
      console.error("Password recovery error:", error);
      toast.error("Failed to send recovery email. Please try again.");
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
