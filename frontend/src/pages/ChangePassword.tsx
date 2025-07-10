import { useChangePassword } from "../hooks/useChangePassword";
import PasswordField from "../components/changePassword/PasswordField";
import PasswordRequirements from "../components/changePassword/PasswordRequirements";
import { PageHeader, Card, CardContent } from "../components/ui";
import { FormActions } from "../components/forms/common";

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

    // Actions
    onSubmit,
    reset,
  } = useChangePassword();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Change Password"
        subtitle="Update your password to keep your account secure."
      />

      {/* Change Password Form */}
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

            {/* Form Actions */}
            <FormActions
              isSubmitting={isSubmitting}
              submitLabel={isSubmitting ? "Changing..." : "Change Password"}
              onCancel={() => reset()}
              cancelLabel="Cancel"
            />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
