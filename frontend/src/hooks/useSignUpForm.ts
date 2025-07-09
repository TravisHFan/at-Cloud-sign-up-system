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

export function useSignUpForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const form = useForm<SignUpFormData>({
    resolver: yupResolver<SignUpFormData, any, any>(signUpSchema),
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
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success(
        "Registration successful! Please check your email to verify your account."
      );

      if (data.isAtCloudLeader === "true") {
        console.log("Sending email to Owner about Leader role request");
        toast.success(
          "Your Leader role request has been sent to the Owner for review."
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
