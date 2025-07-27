import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import {
  changePasswordSchema,
  type ChangePasswordFormData,
} from "../schemas/changePasswordSchema";
import {
  calculatePasswordStrength,
  type PasswordStrength,
} from "../utils/passwordUtils";
import { apiClient } from "../services/api";

export function useChangePassword() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const notification = useToastReplacement();

  const form = useForm<ChangePasswordFormData>({
    resolver: yupResolver(changePasswordSchema),
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

  // Calculate password strength using existing utility
  const passwordStrength: PasswordStrength = calculatePasswordStrength(
    newPassword || ""
  );

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      // Call the real API instead of simulating with setTimeout
      await apiClient.changePassword(
        data.currentPassword,
        data.newPassword,
        data.confirmPassword
      );

      // If we reach here, the API call was successful
      notification.success("Your password has been successfully updated.", {
        title: "Password Changed",
        autoCloseDelay: 4000,
      });
      reset();
    } catch (error: any) {
      console.error("Error changing password:", error);

      // Extract error message from API response
      const errorMessage =
        error.message ||
        "Unable to update your password. Please check your current password and try again.";

      notification.error(errorMessage, {
        title: "Password Change Failed",
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
