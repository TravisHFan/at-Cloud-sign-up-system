import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import type { LoginFormData } from "../schemas/loginSchema";
import { useAuth } from "./useAuth";
import { emailNotificationService } from "../utils/emailNotificationService";
import { findUserByEmail } from "../data/mockUserData";
import {
  canSendVerificationEmail,
  markVerificationEmailSent,
  getRemainingCooldown,
  formatCooldownTime,
} from "../utils/emailValidationUtils";

export function useLogin() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [userEmailForResend, setUserEmailForResend] = useState<string>("");
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (data: LoginFormData) => {
    if (loginAttempts >= 5) {
      toast.error("Too many failed attempts. Please try password recovery.");
      return;
    }

    setIsSubmitting(true);

    try {

      // Call the AuthContext login method
      const result = await login(data);

      if (result.success) {
        toast.success("Login successful!");
        navigate("/dashboard");
      } else {
        // Failed login
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        if (newAttempts >= 5) {
          toast.error(
            "Maximum login attempts reached. Please use password recovery."
          );
        } else {
          toast.error(
            result.error ||
              `Invalid credentials. ${5 - newAttempts} attempts remaining.`
          );
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async (email: string) => {
    try {
      // Check if user exists in the system
      const user = findUserByEmail(email);
      if (!user) {
        toast.error("No account found with this email address.");
        return;
      }

      // Check cooldown period to prevent spam
      if (!canSendVerificationEmail(email)) {
        const remainingTime = getRemainingCooldown(email, "verification");
        toast.error(
          `Please wait ${formatCooldownTime(
            remainingTime
          )} before requesting another verification email.`
        );
        return;
      }

      // Check if email is already verified (in real implementation)
      // For demo purposes, we'll skip this check

      // Generate new verification token
      const verificationToken = `valid_${Math.random()
        .toString(36)
        .substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      await emailNotificationService.sendEmailVerification(
        email,
        user.firstName, // Use actual user's first name
        verificationToken
      );

      // Mark email as sent for cooldown tracking
      markVerificationEmailSent(email);

      toast.success("Verification email sent! Please check your inbox.");
    } catch (error) {
      console.error("Error resending verification email:", error);
      toast.error("Failed to resend verification email. Please try again.");
    }
  };

  const handleResendVerificationFromLogin = async () => {
    if (!userEmailForResend) return;

    setIsResendingVerification(true);
    try {
      await handleResendVerification(userEmailForResend);
      // Clear the verification state after successful resend
      setNeedsVerification(false);
      setUserEmailForResend("");
    } catch (error) {
      console.error("Error resending verification from login:", error);
    } finally {
      setIsResendingVerification(false);
    }
  };

  const resetLoginAttempts = () => {
    setLoginAttempts(0);
    setNeedsVerification(false);
    setUserEmailForResend("");
  };

  return {
    isSubmitting,
    loginAttempts,
    needsVerification,
    userEmailForResend,
    isResendingVerification,
    handleLogin,
    handleResendVerification,
    handleResendVerificationFromLogin,
    resetLoginAttempts,
  };
}
