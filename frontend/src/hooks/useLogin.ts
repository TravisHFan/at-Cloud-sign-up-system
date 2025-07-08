import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import type { LoginFormData } from "../schemas/loginSchema";

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

      // Simulate login failure for demonstration (remove in production)
      const isLoginSuccessful = Math.random() > 0.5;

      if (isLoginSuccessful) {
        toast.success("Login successful!");
        navigate("/dashboard");
      } else {
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

  const resetLoginAttempts = () => {
    setLoginAttempts(0);
  };

  return {
    isSubmitting,
    loginAttempts,
    handleLogin,
    resetLoginAttempts,
  };
}