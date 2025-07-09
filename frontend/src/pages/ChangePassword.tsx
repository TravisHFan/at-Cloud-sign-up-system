import { useChangePassword } from "../hooks/useChangePassword";
import PasswordField from "../components/changePassword/PasswordField";
import PasswordRequirements from "../components/changePassword/PasswordRequirements";
import PasswordStrengthIndicator from "../components/signup/PasswordStrengthIndicator";

export default function ChangePassword() {
  const {
    // Form state
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
    onSubmit,
    reset,
  } = useChangePassword();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Change Password
        </h1>
        <p className="text-gray-600">
          Update your password to keep your account secure.
        </p>
      </div>

      {/* Change Password Form */}
      <div className="bg-white rounded-lg shadow-sm p-6">
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

          {/* Form Actions */}
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400"
            >
              {isSubmitting ? "Changing..." : "Change Password"}
            </button>
            <button
              type="button"
              onClick={() => reset()}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
