import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUserData } from "../hooks/useUserData";
import { useNotifications } from "../contexts/NotificationContext";
import { PageHeader, Card, CardContent } from "../components/ui";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Icon } from "../components/common";

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { users } = useUserData();
  const { startConversation } = useNotifications();

  // Find the user by ID
  const profileUser = users.find((user) => user.id === userId);

  // If user is not found, show error
  if (!profileUser) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader title="User Not Found" />
        <Card>
          <CardContent>
            <p className="text-gray-500">
              The user profile you're looking for doesn't exist.
            </p>
            <Link
              to="/dashboard/management"
              className="text-blue-600 hover:text-blue-800 mt-4 inline-block"
            >
              ← Back to Management
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if the current user is viewing their own profile
  const isOwnProfile = currentUser?.id === userId;

  // Handle starting a chat with this user
  const handleBeginChat = () => {
    if (profileUser) {
      const fullName = `${profileUser.firstName} ${profileUser.lastName}`;
      startConversation(profileUser.id, fullName, profileUser.gender);
      navigate(`/dashboard/chat/${profileUser.id}`);
    }
  };

  // If viewing own profile, redirect to the regular profile page
  useEffect(() => {
    if (isOwnProfile) {
      navigate("/dashboard/profile", { replace: true });
    }
  }, [isOwnProfile, navigate]);

  // If it's own profile and still rendering, show loading
  if (isOwnProfile) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader title="Redirecting..." />
        <Card>
          <CardContent>
            <p className="text-gray-500">Redirecting to your profile...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={`${profileUser.firstName} ${profileUser.lastName}'s Profile`}
      />

      {/* Profile Form - Same layout as Profile.tsx */}
      <Card>
        <CardContent>
          <div className="space-y-6">
            {/* Avatar and Form Layout - Same as Profile.tsx */}
            <div className="flex flex-col lg:flex-row lg:space-x-8 space-y-6 lg:space-y-0">
              {/* Avatar Section - Left Side */}
              <div className="lg:w-1/4 flex-shrink-0">
                <div className="text-center">
                  <div className="mb-4">
                    <img
                      className="w-32 h-32 rounded-full mx-auto object-cover"
                      src={
                        profileUser.avatar ||
                        (profileUser.gender === "male"
                          ? "/default-avatar-male.jpg"
                          : "/default-avatar-female.jpg")
                      }
                      alt={`${profileUser.firstName} ${profileUser.lastName}`}
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {profileUser.firstName} {profileUser.lastName}
                  </h3>
                  <p className="text-sm text-gray-500">
                    @{profileUser.username}
                  </p>
                  <span
                    className={`inline-flex px-3 py-1 text-sm font-medium rounded-full mt-2 ${
                      profileUser.role === "Super Admin"
                        ? "bg-purple-100 text-purple-800"
                        : profileUser.role === "Administrator"
                        ? "bg-red-100 text-red-800"
                        : profileUser.role === "Leader"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {profileUser.role}
                  </span>

                  {/* Begin Chat Button - Only show for other users */}
                  {!isOwnProfile && (
                    <button
                      onClick={handleBeginChat}
                      className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                    >
                      <Icon name="chat-bubble" className="w-4 h-4" />
                      <span>Begin Chat</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Form Fields - Right Side - Read-only version */}
              <div className="lg:w-3/4 flex-grow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.firstName}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.lastName}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      @{profileUser.username}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.email}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md capitalize">
                      {profileUser.gender}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      @Cloud Leader
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.isAtCloudLeader}
                    </div>
                  </div>

                  {profileUser.isAtCloudLeader === "Yes" &&
                    profileUser.roleInAtCloud && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role in @Cloud
                        </label>
                        <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                          {profileUser.roleInAtCloud}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* System Role Display - Same as Profile.tsx */}
            <div className="border-t pt-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  System Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <p className="text-sm text-gray-600">
                    System Role:{" "}
                    <span className="font-medium">{profileUser.role}</span>
                  </p>
                  {"joinDate" in profileUser && (
                    <p className="text-sm text-gray-600">
                      Join Date:{" "}
                      <span className="font-medium">
                        {new Date(
                          profileUser.joinDate as string
                        ).toLocaleDateString()}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
