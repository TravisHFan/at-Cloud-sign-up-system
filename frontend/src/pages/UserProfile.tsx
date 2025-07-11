import { useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUserData } from "../hooks/useUserData";
import { PageHeader, Card, CardContent } from "../components/ui";
import { Link } from "react-router-dom";

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser } = useAuth();
  const { users } = useUserData();

  // Find the user by ID
  const profileUser = users.find((user) => user.id === userId) || currentUser;

  // Check if the current user is viewing their own profile
  const isOwnProfile = currentUser?.id === userId || (!userId && currentUser);

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={
          isOwnProfile
            ? "My Profile"
            : `${profileUser.firstName} ${profileUser.lastName}'s Profile`
        }
        action={
          isOwnProfile ? (
            <div className="flex space-x-3">
              <Link
                to="/dashboard/change-password"
                className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors"
              >
                Change Password
              </Link>
              <Link
                to="/dashboard/profile"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Edit Profile
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Picture */}
        <Card>
          <CardContent>
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
              <p className="text-sm text-gray-500">@{profileUser.username}</p>
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
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Profile Information
              </h3>

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
                    System Role
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {profileUser.role}
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role in @Cloud
                      </label>
                      <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                        {profileUser.roleInAtCloud}
                      </div>
                    </div>
                  )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Join Date
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {"joinDate" in profileUser
                      ? new Date(
                          profileUser.joinDate as string
                        ).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
