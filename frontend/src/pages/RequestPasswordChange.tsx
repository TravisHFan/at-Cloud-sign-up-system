import { useRequestPasswordChange } from "../hooks/useRequestPasswordChange";
import PasswordField from "../components/changePassword/PasswordField";
import PasswordRequirements from "../components/changePassword/PasswordRequirements";
import { PageHeader, Card, CardContent } from "../components/ui";
import { FormActions } from "../components/forms/common";
import { useNavigate } from "react-router-dom";
import { CheckCircleIcon, EnvelopeIcon } from "@heroicons/react/24/outline";

export default function RequestPasswordChange() {
  const navigate = useNavigate();

  const {
    // Form state
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

    // Actions
    onSubmit,
  } = useRequestPasswordChange();

  // If request was successful, show confirmation message
  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Password Change Requested"
          subtitle="Check your email to complete the password change."
        />

        <Card>
          <CardContent className="text-center py-12">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Request Sent Successfully
                </h3>
                <p className="text-gray-600 max-w-md">
                  We've sent a secure password change link to your email
                  address. Please check your inbox and click the link to
                  complete your password change.
                </p>
              </div>

              <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
                <EnvelopeIcon className="w-4 h-4" />
                <span>Check your email for the confirmation link</span>
              </div>

              <div className="space-y-2 text-sm text-gray-500">
                <p>The link will expire in 10 minutes for security.</p>
                <p>If you don't receive the email, check your spam folder.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/profile")}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back to Profile
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Send Another Request
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show the password change request form
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Change Password"
        subtitle="Enter your current password and choose a new secure password. We'll send you an email to confirm the change."
      />

      <Card>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Current Password */}
            <PasswordField
              name="currentPassword"
              label="Current Password"
              register={register}
              errors={errors}
              showPassword={showCurrentPassword}
              onToggleVisibility={() =>
                setShowCurrentPassword(!showCurrentPassword)
              }
            />

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
                <EnvelopeIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">
                    Email Confirmation Required
                  </p>
                  <p className="text-blue-700">
                    For security, we'll send a confirmation link to your email
                    before applying the password change. This helps protect your
                    account from unauthorized changes.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <FormActions
              isSubmitting={isSubmitting}
              submitLabel={
                isSubmitting ? "Sending Request..." : "Request Password Change"
              }
              onCancel={() => navigate("/dashboard/profile")}
              cancelLabel="Cancel"
            />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
