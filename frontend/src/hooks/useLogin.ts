import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToastReplacement } from "../contexts/NotificationModalContext";
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
  const notification = useToastReplacement();
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (data: LoginFormData) => {
    if (loginAttempts >= 5) {
      notification.error(
        "Too many failed attempts. Please try password recovery.",
        {
          title: "Account Temporarily Locked",
          autoCloseDelay: 6000,
        }
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the AuthContext login method
      const result = await login(data);

      if (result.success) {
        notification.success("Welcome back! Redirecting to your dashboard...", {
          title: "Login Successful",
          autoCloseDelay: 2000,
        });
        navigate("/dashboard");
      } else {
        // Failed login
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        if (newAttempts >= 5) {
          notification.error(
            "Maximum login attempts reached. Please use password recovery.",
            {
              title: "Account Locked",
              autoCloseDelay: 6000,
            }
          );
        } else {
          notification.error(
            result.error ||
              `Invalid credentials. ${5 - newAttempts} attempts remaining.`,
            {
              title: "Login Failed",
              autoCloseDelay: 5000,
            }
          );
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      notification.error(
        "Login failed. Please check your connection and try again.",
        {
          title: "Connection Error",
          autoCloseDelay: 5000,
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async (email: string) => {
    try {
      // Check if user exists in the system
      const user = findUserByEmail(email);
      if (!user) {
        notification.error("No account found with this email address.", {
          title: "Account Not Found",
          autoCloseDelay: 4000,
        });
        return;
      }

      // Check cooldown period to prevent spam
      if (!canSendVerificationEmail(email)) {
        const remainingTime = getRemainingCooldown(email, "verification");
        notification.warning(
          `Please wait ${formatCooldownTime(
            remainingTime
          )} before requesting another verification email.`,
          {
            title: "Cooldown Period Active",
            autoCloseDelay: 5000,
          }
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

      notification.success(
        "Verification email sent! Please check your inbox and spam folder.",
        {
          title: "Email Sent",
          autoCloseDelay: 4000,
        }
      );
    } catch (error) {
      console.error("Error resending verification email:", error);
      notification.error(
        "Failed to resend verification email. Please try again.",
        {
          title: "Send Failed",
          autoCloseDelay: 5000,
          actionButton: {
            text: "Retry",
            onClick: () => handleResendVerification(email),
            variant: "primary",
          },
        }
      );
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
