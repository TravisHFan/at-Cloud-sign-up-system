import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useNavigate } from "react-router-dom";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { signUpSchema, type SignUpFormData } from "../schemas/signUpSchema";
import {
  calculatePasswordStrength,
  type PasswordStrength,
} from "../utils/passwordUtils";
import { authService } from "../services/api";

export function useSignUpForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const notification = useToastReplacement();

  const form = useForm<SignUpFormData>({
    resolver: yupResolver(signUpSchema) as any,
    defaultValues: {
      isAtCloudLeader: "false",
    },
    mode: "onChange", // Enable real-time validation
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = form;

  // Watch form values
  const username = watch("username");
  const password = watch("password");
  const isAtCloudLeader = watch("isAtCloudLeader");

  // Calculate password strength
  const passwordStrength: PasswordStrength = calculatePasswordStrength(
    password || ""
  );

  const onSubmit = async (data: SignUpFormData) => {
    setIsSubmitting(true);

    try {
      // Prepare user data for registration
      const userData = {
        username: data.username, // Use the actual username from form
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender as "male" | "female",
        isAtCloudLeader: data.isAtCloudLeader === "true",
        roleInAtCloud: data.roleInAtCloud,
        occupation: data.occupation,
        company: data.company,
        weeklyChurch: data.weeklyChurch,
        homeAddress: data.homeAddress,
        phone: data.phone,
        churchAddress: data.churchAddress,
        acceptTerms: true, // This is handled by validation in the form
      };

      // Call the actual registration API
      await authService.register(userData);

      notification.success(
        "Registration successful! Check your email for a verification link to activate your account.",
        {
          title: "Welcome to @Cloud!",
          autoCloseDelay: 6000,
        }
      );

      // Check if user signed up as @Cloud Co-worker with a role
      if (
        data.isAtCloudLeader === "true" &&
        data.roleInAtCloud &&
        data.roleInAtCloud.trim() !== ""
      ) {
        notification.success(
          "Your @Cloud Co-worker request has been submitted for review by administrators.",
          {
            title: "Co-worker Request Submitted",
            autoCloseDelay: 5000,
          }
        );
      } else if (data.isAtCloudLeader === "true") {
        notification.info(
          "Your @Cloud Co-worker request has been noted. Please update your profile with your role in @Cloud.",
          {
            title: "Co-worker Request Noted",
            autoCloseDelay: 5000,
          }
        );
      }

      // Navigate to check email page after successful registration
      setTimeout(() => {
        navigate("/check-email", {
          state: { email: data.email },
        });
      }, 2000);
    } catch (error: any) {
      console.error("Sign up error:", error);
      notification.error(
        error.message ||
          "Registration failed. Please check your information and try again.",
        {
          title: "Registration Failed",
          autoCloseDelay: 5000,
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    // Form state
    form,
    register,
    errors,
    isSubmitting,

    // Watched values
    username,
    password,
    isAtCloudLeader,
    passwordStrength,

    // Actions
    handleSubmit,
    onSubmit: handleSubmit(onSubmit), // Wrap with react-hook-form validation
  };
}
