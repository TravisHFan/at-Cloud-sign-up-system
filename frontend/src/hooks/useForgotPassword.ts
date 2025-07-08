import { useState } from "react";
import toast from "react-hot-toast";
import type { ForgotPasswordFormData } from "../schemas/loginSchema";

export function useForgotPassword() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);

    try {
      console.log("Password recovery email:", data.email);
      await new Promise((resolve) => setTimeout(resolve, 1000));

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