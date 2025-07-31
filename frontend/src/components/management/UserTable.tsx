import type { User, UserAction } from "../../types/management";
import { getAvatarUrl, getAvatarAlt } from "../../utils/avatarUtils";
import ActionDropdown from "./ActionDropdown";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

interface UserTableProps {
  users: User[];
  getActionsForUser: (user: User) => UserAction[];
  openDropdown: string | null;
  onToggleDropdown: (userId: string) => void;
  currentUserRole: string;
}

export default function UserTable({
  users,
  getActionsForUser,
  openDropdown,
  onToggleDropdown,
  currentUserRole,
}: UserTableProps) {
  const { currentUser } = useAuth();

  // Smart routing: direct current user to their own profile page
  const getProfileLink = (user: User) => {
    return currentUser?.id === user.id
      ? "/dashboard/profile" // Own profile page (editable)
      : `/dashboard/profile/${user.id}`; // View-only profile page
  };
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
          <div className="mt-3 sm:mt-0">
            <span className="text-sm text-gray-500">
              Showing {users.length} users
            </span>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                {currentUserRole !== "Participant" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    System Authorization Level
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  @Cloud Leader or Co-worker
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                {currentUserRole !== "Participant" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                )}
                {currentUserRole !== "Participant" && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user, index) => {
                const actions = getActionsForUser(user);

                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {currentUserRole === "Participant" ? (
                        // Participants cannot click on user profiles
                        <div className="flex items-center">
                          <img
                            className="h-10 w-10 rounded-full object-cover"
                            src={getAvatarUrl(user.avatar || null, user.gender)}
                            alt={getAvatarAlt(
                              user.firstName,
                              user.lastName,
                              !!user.avatar
                            )}
                          />
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Other roles can click on user profiles
                        <Link
                          to={getProfileLink(user)}
                          className="flex items-center hover:bg-gray-100 -m-2 p-2 rounded-lg transition-colors"
                        >
                          <img
                            className="h-10 w-10 rounded-full object-cover"
                            src={getAvatarUrl(user.avatar || null, user.gender)}
                            alt={getAvatarAlt(
                              user.firstName,
                              user.lastName,
                              !!user.avatar
                            )}
                          />
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              @{user.username}
                            </div>
                          </div>
                        </Link>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.email}
                    </td>
                    {currentUserRole !== "Participant" && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full text-center ${
                              user.role === "Super Admin"
                                ? "bg-purple-100 text-purple-800"
                                : user.role === "Administrator"
                                ? "bg-red-100 text-red-800"
                                : user.role === "Leader"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {user.role}
                          </span>
                          {/* Show "Need promotion" for Cloud Leaders who are still Participants, only visible to Super Admin and Administrator */}
                          {user.isAtCloudLeader === "Yes" &&
                            user.role === "Participant" &&
                            (currentUserRole === "Super Admin" ||
                              currentUserRole === "Administrator") && (
                              <span className="text-xs text-orange-600 font-medium mt-1">
                                Need promotion
                              </span>
                            )}
                          {/* Show "Demotion recommended" for Leaders/Administrators who are not @Cloud Leaders or Co-workers, only visible to Super Admin and Administrator */}
                          {user.isAtCloudLeader === "No" &&
                            (user.role === "Leader" ||
                              user.role === "Administrator") &&
                            (currentUserRole === "Super Admin" ||
                              currentUserRole === "Administrator") && (
                              <span className="text-xs text-red-600 font-medium mt-1">
                                Demotion recommended
                              </span>
                            )}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex flex-col">
                        <span>{user.isAtCloudLeader}</span>
                        {user.isAtCloudLeader === "Yes" &&
                          user.roleInAtCloud && (
                            <span className="text-xs text-gray-500">
                              Role: {user.roleInAtCloud}
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.joinDate}
                    </td>
                    {currentUserRole !== "Participant" && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full text-center ${
                            user.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    )}
                    {currentUserRole !== "Participant" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <ActionDropdown
                          userId={user.id}
                          actions={actions}
                          isOpen={openDropdown === user.id}
                          onToggle={onToggleDropdown}
                          showUpward={index >= users.length - 2}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden divide-y divide-gray-200">
        {users.map((user) => {
          const actions = getActionsForUser(user);

          return (
            <div key={user.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                {currentUserRole === "Participant" ? (
                  // Participants cannot click on user profiles
                  <div className="flex items-center flex-1">
                    <img
                      className="h-12 w-12 rounded-full object-cover"
                      src={getAvatarUrl(user.avatar || null, user.gender)}
                      alt={getAvatarAlt(
                        user.firstName,
                        user.lastName,
                        !!user.avatar
                      )}
                    />
                    <div className="ml-4">
                      <div className="text-lg font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        @{user.username}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Other roles can click on user profiles
                  <Link
                    to={getProfileLink(user)}
                    className="flex items-center hover:bg-gray-100 -m-2 p-2 rounded-lg transition-colors flex-1"
                  >
                    <img
                      className="h-12 w-12 rounded-full object-cover"
                      src={getAvatarUrl(user.avatar || null, user.gender)}
                      alt={getAvatarAlt(
                        user.firstName,
                        user.lastName,
                        !!user.avatar
                      )}
                    />
                    <div className="ml-4">
                      <div className="text-lg font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        @{user.username}
                      </div>
                    </div>
                  </Link>
                )}
                {currentUserRole !== "Participant" && (
                  <div className="flex flex-col items-end">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full text-center ${
                        user.role === "Super Admin"
                          ? "bg-purple-100 text-purple-800"
                          : user.role === "Administrator"
                          ? "bg-red-100 text-red-800"
                          : user.role === "Leader"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {user.role}
                    </span>
                    {/* Show "Need promotion" for Cloud Leaders who are still Participants, only visible to Super Admin and Administrator */}
                    {user.isAtCloudLeader === "Yes" &&
                      user.role === "Participant" &&
                      (currentUserRole === "Super Admin" ||
                        currentUserRole === "Administrator") && (
                        <span className="text-xs text-orange-600 font-medium mt-1">
                          Need promotion
                        </span>
                      )}
                    {/* Show "Demotion recommended" for Leaders/Administrators who are not @Cloud Leaders or Co-workers, only visible to Super Admin and Administrator */}
                    {user.isAtCloudLeader === "No" &&
                      (user.role === "Leader" ||
                        user.role === "Administrator") &&
                      (currentUserRole === "Super Admin" ||
                        currentUserRole === "Administrator") && (
                        <span className="text-xs text-red-600 font-medium mt-1">
                          Demotion recommended
                        </span>
                      )}
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Email:</span>
                  <span className="ml-2 text-gray-900">{user.email}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">
                    @Cloud Leader:
                  </span>
                  <span className="ml-2 text-gray-900">
                    {user.isAtCloudLeader}
                  </span>
                  {user.isAtCloudLeader === "Yes" && user.roleInAtCloud && (
                    <div className="mt-1">
                      <span className="font-medium text-gray-600">Role: </span>
                      <span className="text-gray-900">
                        {user.roleInAtCloud}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <span className="font-medium text-gray-600">Joined:</span>
                  <span className="ml-2 text-gray-900">{user.joinDate}</span>
                </div>
                {currentUserRole !== "Participant" && (
                  <div>
                    <span className="font-medium text-gray-600">Status:</span>
                    <span
                      className={`ml-2 inline-block px-2 py-0.5 text-xs font-medium rounded-full text-center ${
                        user.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                )}
              </div>

              {currentUserRole !== "Participant" && (
                <div className="mt-4">
                  <ActionDropdown
                    userId={user.id}
                    actions={actions}
                    isOpen={openDropdown === user.id}
                    onToggle={onToggleDropdown}
                    isMobile={true}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
