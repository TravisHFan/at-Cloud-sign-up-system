import { useState, useEffect } from "react";
import {
  ChevronDownIcon,
  EllipsisVerticalIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import type {
  User,
  SystemRole,
  UserAction,
  RoleStats,
} from "../types/management";
import { useUserData } from "../hooks/useUserData";

export default function Management() {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  // Mock current user role - this will come from auth context
  const currentUserRole: SystemRole = "Super Admin";

  // Use the custom hook for user data management
  const { users, promoteUser, demoteUser, deleteUser } = useUserData();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".dropdown-container")) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown]);

  const handlePromoteUser = (userId: number, newRole: SystemRole) => {
    promoteUser(userId, newRole);
    setOpenDropdown(null);
  };

  const handleDemoteUser = (userId: number, newRole: SystemRole) => {
    demoteUser(userId, newRole);
    setOpenDropdown(null);
  };

  const handleDeleteUser = (userId: number) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      deleteUser(userId);
      setOpenDropdown(null);
    }
  };

  // Generate actions based on current user role and target user role
  const getActionsForUser = (user: User): UserAction[] => {
    const actions: UserAction[] = [];

    if (currentUserRole === "Super Admin") {
      // Super Admin can promote/demote anyone
      if (user.role === "User") {
        actions.push(
          {
            label: "Promote to Leader",
            onClick: () => handlePromoteUser(user.id, "Leader"),
            className: "text-green-600 hover:text-green-900 hover:bg-green-50",
          },
          {
            label: "Promote to Administrator",
            onClick: () => handlePromoteUser(user.id, "Administrator"),
            className: "text-blue-600 hover:text-blue-900 hover:bg-blue-50",
          }
        );
      } else if (user.role === "Leader") {
        actions.push(
          {
            label: "Promote to Administrator",
            onClick: () => handlePromoteUser(user.id, "Administrator"),
            className: "text-blue-600 hover:text-blue-900 hover:bg-blue-50",
          },
          {
            label: "Demote to User",
            onClick: () => handleDemoteUser(user.id, "User"),
            className:
              "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
          }
        );
      } else if (user.role === "Administrator") {
        actions.push(
          {
            label: "Demote to Leader",
            onClick: () => handleDemoteUser(user.id, "Leader"),
            className:
              "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
          },
          {
            label: "Demote to User",
            onClick: () => handleDemoteUser(user.id, "User"),
            className:
              "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
          }
        );
      }

      // Only Super Admin can delete users
      actions.push({
        label: "Delete User",
        onClick: () => handleDeleteUser(user.id),
        className: "text-red-600 hover:text-red-900 hover:bg-red-50",
      });
    } else if (currentUserRole === "Administrator") {
      // Administrator can promote Users to Leader and demote Leaders to User
      if (user.role === "User") {
        actions.push({
          label: "Promote to Leader",
          onClick: () => handlePromoteUser(user.id, "Leader"),
          className: "text-green-600 hover:text-green-900 hover:bg-green-50",
        });
      } else if (user.role === "Leader") {
        actions.push({
          label: "Demote to User",
          onClick: () => handleDemoteUser(user.id, "User"),
          className: "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
        });
      }

      // Administrator cannot delete users or modify other Administrators
      if (user.role === "Administrator") {
        actions.push({
          label: "No Actions Available",
          onClick: () => {},
          className: "text-gray-400 cursor-not-allowed",
          disabled: true,
        });
      }
    } else {
      // Leaders and Users have no management permissions
      actions.push({
        label: "No Actions Available",
        onClick: () => {},
        className: "text-gray-400 cursor-not-allowed",
        disabled: true,
      });
    }

    return actions;
  };

  const toggleDropdown = (userId: number) => {
    setOpenDropdown(openDropdown === userId ? null : userId);
  };

  // Get role counts for statistics
  const getRoleStats = (): RoleStats => {
    const stats: RoleStats = {
      total: users.length,
      superAdmin: 1, // There's only one Super Admin
      administrators: users.filter((user) => user.role === "Administrator")
        .length,
      leaders: users.filter((user) => user.role === "Leader").length,
      users: users.filter((user) => user.role === "User").length,
      atCloudLeaders: users.filter(
        (user) => user.atCloudRole === "I'm an @Cloud Leader"
      ).length,
    };
    return stats;
  };

  const roleStats = getRoleStats();

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          User Management
        </h1>
        <p className="text-gray-600 mb-6">
          Manage user roles and permissions for @Cloud Marketplace Ministry. As
          a {currentUserRole}, you can view all users and manage their access
          levels.
        </p>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Users</p>
                <p className="text-2xl font-bold text-blue-900">
                  {roleStats.total + 1}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShieldCheckIcon className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-600">
                  Administrators
                </p>
                <p className="text-2xl font-bold text-red-900">
                  {roleStats.administrators}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserIcon className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-600">Leaders</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {roleStats.leaders}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Users</p>
                <p className="text-2xl font-bold text-green-900">
                  {roleStats.users}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">
                  @Cloud Leaders
                </p>
                <p className="text-2xl font-bold text-purple-900">
                  {roleStats.atCloudLeaders}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Management Table */}
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
                            src={`/api/placeholder/40/40`}
                            alt={user.username}
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
                        <div className="relative dropdown-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDropdown(user.id);
                            }}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <EllipsisVerticalIcon className="w-4 h-4 mr-1" />
                            Actions
                            <ChevronDownIcon className="w-4 h-4 ml-1" />
                          </button>

                          {/* Dropdown Menu */}
                          {openDropdown === user.id && (
                            <div
                              className={`absolute mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 ${
                                index >= users.length - 2
                                  ? "bottom-full mb-2"
                                  : "top-full"
                              } right-0`}
                            >
                              <div className="py-1">
                                {actions.length > 0 ? (
                                  actions.map((action, actionIndex) => (
                                    <button
                                      key={actionIndex}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!action.disabled) {
                                          action.onClick();
                                        }
                                      }}
                                      disabled={action.disabled}
                                      className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                                        action.className
                                      } ${
                                        action.disabled
                                          ? "cursor-not-allowed"
                                          : "cursor-pointer"
                                      }`}
                                    >
                                      {action.label}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-4 py-2 text-sm text-gray-500">
                                    No actions available
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
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
                      src={`/api/placeholder/48/48`}
                      alt={user.username}
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
                    <span className="ml-2 text-gray-900">
                      {user.atCloudRole}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Joined:</span>
                    <span className="ml-2 text-gray-900">{user.joinDate}</span>
                  </div>
                </div>

                <div className="mt-4 relative dropdown-container">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDropdown(user.id);
                    }}
                    className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <EllipsisVerticalIcon className="w-4 h-4 mr-1" />
                    Actions
                    <ChevronDownIcon className="w-4 h-4 ml-1" />
                  </button>

                  {/* Mobile Dropdown Menu */}
                  {openDropdown === user.id && (
                    <div className="absolute left-0 right-0 mt-2 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                      <div className="py-1">
                        {actions.length > 0 ? (
                          actions.map((action, actionIndex) => (
                            <button
                              key={actionIndex}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!action.disabled) {
                                  action.onClick();
                                }
                              }}
                              disabled={action.disabled}
                              className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                                action.className
                              } ${
                                action.disabled
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer"
                              }`}
                            >
                              {action.label}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-sm text-gray-500">
                            No actions available
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
