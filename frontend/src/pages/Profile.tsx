import { useProfileForm } from "../hooks/useProfileForm";
import AvatarUpload from "../components/profile/AvatarUpload";
import ProfileFormFields from "../components/profile/ProfileFormFields";

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          {!isEditing && (
            <button
              onClick={handleEdit}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Avatar and Form Layout */}
          <div className="flex flex-col lg:flex-row lg:space-x-8 space-y-6 lg:space-y-0">
            {/* Avatar Section - Left Side */}
            <div className="lg:w-1/3 flex-shrink-0">
              <AvatarUpload
                avatarPreview={avatarPreview}
                isEditing={isEditing}
                gender={userData.gender as "male" | "female"}
                customAvatar={userData.avatar}
                onAvatarChange={handleAvatarChange}
              />
            </div>

            {/* Form Fields - Right Side */}
            <div className="lg:w-2/3 flex-grow">
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
                  Note: Super Admin and Administrators will be notified of this
                  Leader role request.
                </p>
              </div>
            )}

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex space-x-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
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
      </div>
    </div>
  );
}
