import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useNavigate } from "react-router-dom";
// import toast from "react-hot-toast"; // MIGRATED: Replaced with custom notifications
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { signUpSchema, type SignUpFormData } from "../schemas/signUpSchema";
import {
  calculatePasswordStrength,
  type PasswordStrength,
} from "../utils/passwordUtils";
import { emailNotificationService } from "../utils/emailNotificationService";

export function useSignUpForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const notification = useToastReplacement();

  const form = useForm<SignUpFormData>({
    resolver: yupResolver(signUpSchema) as any,
    defaultValues: {
      isAtCloudLeader: "false",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = form;

  // Watch form values
  const password = watch("password");
  const isAtCloudLeader = watch("isAtCloudLeader");

  // Calculate password strength
  const passwordStrength: PasswordStrength = calculatePasswordStrength(
    password || ""
  );

  const onSubmit = async (data: SignUpFormData) => {
    setIsSubmitting(true);

    try {
      // Generate verification token for demo purposes
      const verificationToken = `valid_${Math.random()
        .toString(36)
        .substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      // Simulate API call to create user account (but not activate it)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send email verification
      try {
        await emailNotificationService.sendEmailVerification(
          data.email,
          data.firstName,
          verificationToken
        );

        notification.success(
          "Registration successful! Please check your email to verify your account before logging in.",
          {
            title: "Welcome to @Cloud!",
            autoCloseDelay: 6000,
          }
        );

        // For demo purposes, show the verification link
        setTimeout(() => {
          notification.info(
            `Demo: Click here to verify: /verify-email/${verificationToken}`,
            {
              title: "Demo Verification Link",
              autoCloseDelay: 8000,
              actionButton: {
                text: "Verify Now",
                onClick: () => navigate(`/verify-email/${verificationToken}`),
                variant: "primary",
              },
            }
          );
        }, 1000);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        notification.warning(
          "Registration successful! However, verification email may have failed. Please contact support.",
          {
            title: "Registration Complete",
            autoCloseDelay: 6000,
          }
        );
      }

      // Check if user signed up as @Cloud Leader with a role
      if (
        data.isAtCloudLeader === "true" &&
        data.roleInAtCloud &&
        data.roleInAtCloud.trim() !== ""
      ) {
        try {
          await emailNotificationService.sendNewLeaderSignupNotification({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            roleInAtCloud: data.roleInAtCloud,
          });

          // Note: System messages for new leader signup will be created server-side
          // when the registration is processed by the backend
          console.log(
            "New leader registration processed for:",
            data.firstName,
            data.lastName
          );

          notification.success(
            "Your Leader role request has been sent to Super Admin and Administrators for review.",
            {
              title: "Leader Role Request Submitted",
              autoCloseDelay: 5000,
            }
          );
        } catch (adminEmailError) {
          console.error("Failed to send admin notification:", adminEmailError);
          // Don't show error to user for admin notification failure
        }
      } else if (data.isAtCloudLeader === "true") {
        notification.info(
          "Your Leader role request has been noted. Please update your profile with your role in @Cloud.",
          {
            title: "Role Request Noted",
            autoCloseDelay: 5000,
          }
        );
      }

      navigate("/login");
    } catch (error) {
      console.error("Sign up error:", error);
      notification.error(
        "Registration failed. Please check your information and try again.",
        {
          title: "Registration Failed",
          autoCloseDelay: 5000,
          actionButton: {
            text: "Try Again",
            onClick: () => window.location.reload(),
            variant: "primary",
          },
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
    password,
    isAtCloudLeader,
    passwordStrength,

    // Actions
    onSubmit: handleSubmit(onSubmit),
  };
}
