import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { authService } from "../services/api";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { PageHeader, Card, CardContent } from "../components/ui";
import PasswordField from "../components/forms/CustomPasswordField";
import PasswordRequirements from "../components/forms/PasswordRequirements";
import { FormActions } from "../components/forms/common";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

// Form validation schema - comprehensive validation like Change Password page
const resetPasswordSchema = yup.object().shape({
  newPassword: yup
    .string()
    .min(8, "Password must be at least 8 characters long")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    )
    .required("New password is required"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("newPassword")], "Passwords must match")
    .required("Please confirm your password"),
});

interface ResetPasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const notification = useToastReplacement();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: yupResolver(resetPasswordSchema),
    mode: "onChange", // Enable real-time validation like Change Password page
  });

  const newPassword = watch("newPassword");

  // Validate token on component mount
  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      setIsValidToken(false);
      return;
    }

    // For now, we'll assume the token is valid
    // In a real implementation, you might want to validate it with the backend
    setIsValidating(false);
    setIsValidToken(true);
  }, [token]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;

    setIsSubmitting(true);

    try {
      await authService.resetPassword(
        token,
        data.newPassword,
        data.confirmPassword
      );

      setIsSuccess(true);
      notification.success(
        "Your password has been reset successfully! You can now log in with your new password.",
        {
          title: "Password Reset Complete",
          autoCloseDelay: 6000,
        }
      );

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error: any) {
      console.error("Password reset error:", error);

      const errorMessage =
        error.message ||
        "Failed to reset password. Please try again or request a new reset link.";

      notification.error(errorMessage, {
        title: "Password Reset Failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validating token state
  if (isValidating) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Validating Reset Link"
          subtitle="Please wait while we verify your password reset link."
        />

        <Card>
          <CardContent className="text-center py-12">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16">
                <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Verifying Reset Link
                </h3>
                <p className="text-gray-600">
                  Please wait while we verify your password reset link.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (!isValidToken) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Invalid Reset Link"
          subtitle="This password reset link is not valid or has expired."
        />

        <Card>
          <CardContent className="text-center py-12">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Invalid Reset Link
                </h3>
                <p className="text-gray-600 max-w-md">
                  This password reset link is invalid, has expired, or has
                  already been used.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md">
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">What to do next:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Request a new password reset</li>
                    <li>Check that you used the most recent reset email</li>
                    <li>Make sure the link wasn't corrupted when copying</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Request New Reset
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go Home
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Password Reset Successfully"
          subtitle="Your password has been updated. You can now log in with your new password."
        />

        <Card>
          <CardContent className="text-center py-12">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Password Reset Complete!
                </h3>
                <p className="text-gray-600 max-w-md">
                  Your password has been successfully updated. You'll be
                  redirected to the login page shortly.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md">
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-1">Security Notice</p>
                  <p>
                    For your security, you've received email confirmation about
                    this password reset. If you didn't make this change, please
                    contact support immediately.
                  </p>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                <p>Redirecting to login page in a few seconds...</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go to Login
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Reset Your Password"
        subtitle="Enter your new password to complete the reset process."
      />

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* New Password */}
            <PasswordField
              name="newPassword"
              label="New Password"
              register={register}
              errors={errors}
              showPassword={showNewPassword}
              onToggleVisibility={() => setShowNewPassword(!showNewPassword)}
              showStrengthIndicator={true}
              password={newPassword}
            />

            {/* Confirm Password */}
            <PasswordField
              name="confirmPassword"
              label="Confirm New Password"
              register={register}
              errors={errors}
              showPassword={showConfirmPassword}
              onToggleVisibility={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
            />

            {/* Password Requirements */}
            <PasswordRequirements password={newPassword || ""} />

            {/* Security Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <CheckCircleIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">
                    Security Notice
                  </p>
                  <p className="text-blue-700">
                    After resetting your password, you'll receive a confirmation
                    email and all your active sessions will be logged out for
                    security.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <FormActions
              isSubmitting={isSubmitting}
              submitLabel={
                isSubmitting ? "Resetting Password..." : "Reset Password"
              }
              onCancel={() => navigate("/login")}
              cancelLabel="Back to Login"
            />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
