import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import {
  requestPasswordChangeSchema,
  type RequestPasswordChangeFormData,
} from "../schemas/requestPasswordChangeSchema";
import { getPasswordStrength } from "../utils/passwordStrength";
import { userService } from "../services/api";

export function useRequestPasswordChange() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const notification = useToastReplacement();

  const form = useForm<RequestPasswordChangeFormData>({
    resolver: yupResolver(requestPasswordChangeSchema),
    mode: "onChange",
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = form;

  // Watch new password for strength calculation
  const newPassword = watch("newPassword");

  // Calculate password strength using standard utility (same as signup page)
  const passwordStrength = getPasswordStrength(newPassword || "");

  const onSubmit = async (data: RequestPasswordChangeFormData) => {
    try {
      const response = await userService.requestPasswordChange(
        data.currentPassword,
        data.newPassword
      );

      // If we reach here, the API call was successful
      setIsSuccess(true);

      notification.success(
        response.message ||
          "Password change request sent. Please check your email to confirm.",
        {
          title: "Request Sent",
          autoCloseDelay: 6000,
        }
      );

      reset();
    } catch (error: any) {
      console.error("Error requesting password change:", error);

      // Extract error message from API response
      const errorMessage =
        error.message ||
        "Unable to process your password change request. Please check your current password and try again.";

      notification.error(errorMessage, {
        title: "Request Failed",
        actionButton: {
          text: "Retry",
          onClick: () => onSubmit(data),
        },
      });
    }
  };

  return {
    // Form state
    form,
    register,
    errors,
    isSubmitting,
    isSuccess,

    // Password visibility state
    showCurrentPassword,
    showNewPassword,
    showConfirmPassword,
    setShowCurrentPassword,
    setShowNewPassword,
    setShowConfirmPassword,

    // Watched values
    newPassword,
    passwordStrength,

    // Actions
    onSubmit: handleSubmit(onSubmit),
    reset,
  };
}
