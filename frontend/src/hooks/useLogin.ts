import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import type { LoginFormData } from "../schemas/loginSchema";
import { emailNotificationService } from "../utils/emailNotificationService";

export function useLogin() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const navigate = useNavigate();

  const handleLogin = async (data: LoginFormData) => {
    if (loginAttempts >= 5) {
      toast.error("Too many failed attempts. Please try password recovery.");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("Login data:", data);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate different login scenarios for demonstration
      const random = Math.random();

      if (random > 0.8) {
        // Simulate unverified email scenario
        toast.error(
          "Please verify your email address before logging in. Check your inbox for the verification link."
        );

        // Option to resend verification email
        setTimeout(() => {
          toast.success(
            "Need a new verification email? We can resend it for you.",
            {
              duration: 5000,
              icon: "📧",
            }
          );
        }, 2000);

        return;
      } else if (random > 0.4) {
        // Successful login
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
      // Generate new verification token
      const verificationToken = `valid_${Math.random()
        .toString(36)
        .substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      await emailNotificationService.sendEmailVerification(
        email,
        "User", // In real implementation, get actual first name
        verificationToken
      );

      toast.success("Verification email sent! Please check your inbox.");
    } catch (error) {
      console.error("Error resending verification email:", error);
      toast.error("Failed to resend verification email. Please try again.");
    }
  };

  const resetLoginAttempts = () => {
    setLoginAttempts(0);
  };

  return {
    isSubmitting,
    loginAttempts,
    handleLogin,
    handleResendVerification,
    resetLoginAttempts,
  };
}
