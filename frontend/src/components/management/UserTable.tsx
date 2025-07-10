import type { User, UserAction } from "../../types/management";
import { getAvatarUrl, getAvatarAlt } from "../../utils/avatarUtils";
import ActionDropdown from "./ActionDropdown";

interface UserTableProps {
  users: User[];
  getActionsForUser: (user: User) => UserAction[];
  openDropdown: number | null;
  onToggleDropdown: (userId: number) => void;
}

export default function UserTable({
  users,
  getActionsForUser,
  openDropdown,
  onToggleDropdown,
}: UserTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
          <div className="mt-3 sm:mt-0">
            <span className="text-sm text-gray-500">
              Showing {users.length} users (+ 1 Super Admin)
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  System Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  @Cloud Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user, index) => {
                const actions = getActionsForUser(user);

                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          className="h-10 w-10 rounded-full"
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.atCloudRole}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.joinDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <ActionDropdown
                        userId={user.id}
                        actions={actions}
                        isOpen={openDropdown === user.id}
                        onToggle={onToggleDropdown}
                        showUpward={index >= users.length - 2}
                      />
                    </td>
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
                <div className="flex items-center">
                  <img
                    className="h-12 w-12 rounded-full"
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
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Email:</span>
                  <span className="ml-2 text-gray-900">{user.email}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">
                    @Cloud Role:
                  </span>
                  <span className="ml-2 text-gray-900">{user.atCloudRole}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Joined:</span>
                  <span className="ml-2 text-gray-900">{user.joinDate}</span>
                </div>
              </div>

              <div className="mt-4">
                <ActionDropdown
                  userId={user.id}
                  actions={actions}
                  isOpen={openDropdown === user.id}
                  onToggle={onToggleDropdown}
                  isMobile={true}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
