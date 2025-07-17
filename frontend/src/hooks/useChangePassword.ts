import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import toast from "react-hot-toast";
import {
  changePasswordSchema,
  type ChangePasswordFormData,
} from "../schemas/changePasswordSchema";
import {
  calculatePasswordStrength,
  type PasswordStrength,
} from "../utils/passwordUtils";

export function useChangePassword() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ChangePasswordFormData>({
    resolver: yupResolver(changePasswordSchema) as any,
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

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Password changed successfully!");
      reset();
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Failed to change password. Please try again.");
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
