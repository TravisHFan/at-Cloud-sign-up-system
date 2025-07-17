import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../contexts/NotificationContext";
import { PageHeader, Card, CardContent } from "../components/ui";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Icon } from "../components/common";
import { userService } from "../services/api";
import { getAvatarUrl, getAvatarAlt } from "../utils/avatarUtils";
import toast from "react-hot-toast";

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { startConversation } = useNotifications();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  // Single useEffect to handle all logic
  useEffect(() => {
    const fetchUserProfile = async () => {

      if (!userId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // If viewing own profile, redirect
      if (isOwnProfile) {
        navigate("/dashboard/profile", { replace: true });
        return;
      }

      try {
        setLoading(true);
        const fetchedUser = await userService.getUser(userId);

        // Check if we received any user data at all
        if (!fetchedUser) {
          setNotFound(true);
          return;
        }

        setProfileUser(fetchedUser);
        setNotFound(false);
      } catch (error) {
        console.error("UserProfile: Error fetching user", error);
        setNotFound(true);
        toast.error("Unable to load user profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, isOwnProfile, navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader title="Loading Profile..." />
        <Card>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-500">
                Loading user profile...
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user is not found, show error
  if (notFound || !profileUser) {
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
                      src={getAvatarUrl(
                        profileUser.avatar || null,
                        profileUser.gender || "male"
                      )}
                      alt={getAvatarAlt(
                        profileUser.firstName,
                        profileUser.lastName,
                        !!profileUser.avatar
                      )}
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

                  {/* Chat Button - Only show for other users */}
                  {!isOwnProfile && (
                    <button
                      onClick={handleBeginChat}
                      className={`w-32 mx-auto mt-4 ${
                        profileUser.gender === "female"
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      } text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2`}
                    >
                      <Icon name="chat-bubble" className="w-4 h-4" />
                      <span>Chat</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Form Section - Right Side */}
              <div className="lg:w-3/4">
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
                      {profileUser.username}
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
                      Phone
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.phone || "Not provided"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md capitalize">
                      {profileUser.gender || "Not specified"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      @Cloud Leader
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.isAtCloudLeader ? "Yes" : "No"}
                    </div>
                  </div>

                  {profileUser.isAtCloudLeader && profileUser.roleInAtCloud && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role in @Cloud
                      </label>
                      <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                        {profileUser.roleInAtCloud}
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Home Address
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.homeAddress || "Not provided"}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Occupation
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.occupation || "Not provided"}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.company || "Not provided"}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weekly Church
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.weeklyChurch || "Not provided"}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Church Address
                    </label>
                    <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {profileUser.churchAddress || "Not provided"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Authorization Level Display */}
            <div className="border-t pt-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  System Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <p className="text-sm text-gray-600">
                    System Authorization Level:{" "}
                    <span className="font-medium">{profileUser.role}</span>
                  </p>
                  {profileUser.createdAt && (
                    <p className="text-sm text-gray-600">
                      Join Date:{" "}
                      <span className="font-medium">
                        {new Date(profileUser.createdAt).toLocaleDateString()}
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
