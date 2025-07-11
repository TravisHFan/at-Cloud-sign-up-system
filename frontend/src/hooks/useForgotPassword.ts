import { useState } from "react";
import toast from "react-hot-toast";
import type { ForgotPasswordFormData } from "../schemas/loginSchema";
import { emailNotificationService } from "../utils/emailNotificationService";

export function useForgotPassword() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);

    try {
      console.log("Password recovery email:", data.email);

      // Generate a temporary reset token for demo purposes
      const resetToken =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

      // Send password reset email using our notification service
      await emailNotificationService.sendPasswordResetNotification(
        data.email,
        resetToken,
        "User" // In real implementation, this would be retrieved from user data
      );

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
