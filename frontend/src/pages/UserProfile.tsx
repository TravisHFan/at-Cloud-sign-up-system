import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../contexts/NotificationContext";
import { PageHeader, Card, CardContent } from "../components/ui";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Icon } from "../components/common";
import { userService } from "../services/api";
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

  useEffect(() => {
    const fetchUserProfile = async () => {
      console.log("UserProfile: Starting fetch", { userId, isOwnProfile });

      if (!userId) {
        console.log("UserProfile: No userId");
        setNotFound(true);
        setLoading(false);
        return;
      }

      // If viewing own profile, redirect
      if (isOwnProfile) {
        console.log("UserProfile: Redirecting to own profile");
        navigate("/dashboard/profile", { replace: true });
        return;
      }

      try {
        console.log("UserProfile: Fetching user from API");
        setLoading(true);
        const fetchedUser = await userService.getUser(userId);
        console.log("UserProfile: API response", fetchedUser);

        if (fetchedUser) {
          setProfileUser(fetchedUser);
          setNotFound(false);
        } else {
          console.log("UserProfile: No user data received");
          setNotFound(true);
        }
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

  // Handle starting a chat with this user
  const handleBeginChat = () => {
    if (profileUser) {
      const fullName = `${profileUser.firstName} ${profileUser.lastName}`;
      startConversation(profileUser.id, fullName, profileUser.gender);
      navigate(`/dashboard/chat/${profileUser.id}`);
    }
  };

  useEffect(() => {
    console.log("UserProfile: Checking if own profile", {
      currentUserId: currentUser?.id,
      userId,
      isOwnProfile,
    });
    if (isOwnProfile && currentUser && userId) {
      console.log("UserProfile: Redirecting to own profile");
      navigate("/dashboard/profile", { replace: true });
    }
  }, [isOwnProfile, navigate, currentUser, userId]);

  // If it's own profile and still rendering, show loading
  if (isOwnProfile) {
    console.log("UserProfile: Rendering own profile redirect page");
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

                  {/* Chat Button - Only show for other users */}
                  {!isOwnProfile && (
                    <button
                      onClick={handleBeginChat}
                      className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center"
                    >
                      <Icon name="chat-bubble" className="w-4 h-4 mr-2" />
                      Begin Chat
                    </button>
                  )}
                </div>
              </div>

              {/* Form Section - Right Side */}
              <div className="lg:w-3/4">
                <div className="space-y-6">
                  {/* Basic Information */}
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
                        Gender
                      </label>
                      <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md capitalize">
                        {profileUser.gender || "Not specified"}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Join Date
                      </label>
                      <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                        {profileUser.createdAt
                          ? new Date(profileUser.createdAt).toLocaleDateString()
                          : "Not available"}
                      </div>
                    </div>
                  </div>

                  {/* @Cloud Information */}
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">
                      @Cloud Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          @Cloud Leader
                        </label>
                        <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                          {profileUser.isAtCloudLeader ? "Yes" : "No"}
                        </div>
                      </div>

                      {profileUser.roleInAtCloud && (
                        <div>
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

                  {/* Professional Information */}
                  {(profileUser.occupation || profileUser.company) && (
                    <div className="border-t pt-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-4">
                        Professional Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {profileUser.occupation && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Occupation
                            </label>
                            <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                              {profileUser.occupation}
                            </div>
                          </div>
                        )}

                        {profileUser.company && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Company
                            </label>
                            <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                              {profileUser.company}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Church Information */}
                  {profileUser.weeklyChurch && (
                    <div className="border-t pt-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-4">
                        Church Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Weekly Church
                          </label>
                          <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                            {profileUser.weeklyChurch}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
                    <span
                      className={`font-medium ${
                        profileUser.role === "Super Admin"
                          ? "text-purple-600"
                          : profileUser.role === "Administrator"
                          ? "text-red-600"
                          : profileUser.role === "Leader"
                          ? "text-yellow-600"
                          : "text-green-600"
                      }`}
                    >
                      {profileUser.role}
                    </span>
                  </p>
                  {profileUser.isAtCloudLeader && (
                    <p className="text-sm text-gray-600">
                      @Cloud Leader Status:{" "}
                      <span className="font-medium text-blue-600">
                        {profileUser.roleInAtCloud || "Leader"}
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
