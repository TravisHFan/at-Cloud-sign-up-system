import { useProfileForm } from "../hooks/useProfileForm";
import AvatarUpload from "../components/profile/AvatarUpload";
import ProfileFormFields from "../components/profile/ProfileFormFields";
import { PageHeader, Card, CardContent, Button } from "../components/ui";
import { FormActions } from "../components/forms/common";
import { Link } from "react-router-dom";

export default function Profile() {
  const {
    // Form state
    form,
    isEditing,
    userData,

    // Avatar state
    avatarPreview,

    // Watched values
    watchedValues,

    // Actions
    onSubmit,
    handleEdit,
    handleCancel,
    handleAvatarChange,
  } = useProfileForm();

  const currentIsAtCloudLeader = watchedValues.isAtCloudLeader;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="My Profile"
        action={
          !isEditing ? (
            <div className="flex space-x-3">
              <Link
                to="/dashboard/change-password"
                className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors"
              >
                Change Password
              </Link>
              <Button onClick={handleEdit} variant="primary">
                Edit Profile
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Profile Form */}
      <Card>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Avatar and Form Layout */}
            <div className="flex flex-col lg:flex-row lg:space-x-8 space-y-6 lg:space-y-0">
              {/* Avatar Section - Left Side */}
              <div className="lg:w-1/4 flex-shrink-0">
                <AvatarUpload
                  avatarPreview={avatarPreview}
                  isEditing={isEditing}
                  gender={userData.gender as "male" | "female"}
                  customAvatar={userData.avatar}
                  userId={userData.id}
                  fullName={`${userData.firstName} ${userData.lastName}`}
                  onAvatarChange={handleAvatarChange}
                />
              </div>

              {/* Form Fields - Right Side */}
              <div className="lg:w-3/4 flex-grow">
                <ProfileFormFields form={form} isEditing={isEditing} />
              </div>
            </div>

            {/* Role Change Notification */}
            {isEditing &&
              userData.systemRole === "Participant" && // Changed from "User"
              userData.isAtCloudLeader === "No" &&
              currentIsAtCloudLeader === "Yes" && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <p className="text-sm text-blue-600">
                    Note: Super Admin and Administrators will be notified of
                    this Leader role request.
                  </p>
                </div>
              )}

            {/* Action Buttons */}
            {isEditing && (
              <FormActions
                isSubmitting={false}
                submitLabel="Save Changes"
                onCancel={handleCancel}
                cancelLabel="Cancel"
              />
            )}

            {/* System Role Display */}
            {!isEditing && (
              <div className="border-t pt-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    System Information
                  </h3>
                  <p className="text-sm text-gray-600">
                    System Role:{" "}
                    <span className="font-medium">{userData.systemRole}</span>
                  </p>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
