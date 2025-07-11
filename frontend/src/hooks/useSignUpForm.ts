import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { signUpSchema, type SignUpFormData } from "../schemas/signUpSchema";
import {
  calculatePasswordStrength,
  type PasswordStrength,
} from "../utils/passwordUtils";
import { emailNotificationService } from "../utils/emailNotificationService";
import { systemMessageIntegration } from "../utils/systemMessageIntegration";

export function useSignUpForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

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
      console.log("Sign up data:", data);

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

        toast.success(
          "Registration successful! Please check your email to verify your account before logging in.",
          { duration: 6000 }
        );

        // For demo purposes, show the verification link
        setTimeout(() => {
          toast.success(
            `Demo: Click here to verify: /verify-email/${verificationToken}`,
            {
              duration: 8000,
              icon: "🔗",
            }
          );
        }, 1000);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        toast.success(
          "Registration successful! However, verification email may have failed. Please contact support.",
          { duration: 6000 }
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

          // Send system message for new leader signup (message from new leader)
          // Note: In a real system, we'd get the actual user ID from the registration response
          const mockUserId = `user_${Date.now()}`; // Temporary user ID for demo
          systemMessageIntegration.sendNewLeaderSignupSystemMessage({
            id: mockUserId,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            roleInAtCloud: data.roleInAtCloud,
          });

          toast.success(
            "Your Leader role request has been sent to Super Admin and Administrators for review.",
            { duration: 5000 }
          );
        } catch (adminEmailError) {
          console.error("Failed to send admin notification:", adminEmailError);
          // Don't show error to user for admin notification failure
        }
      } else if (data.isAtCloudLeader === "true") {
        toast.success(
          "Your Leader role request has been noted. Please update your profile with your role in @Cloud.",
          { duration: 5000 }
        );
      }

      navigate("/login");
    } catch (error) {
      console.error("Sign up error:", error);
      toast.error("Registration failed. Please try again.");
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
