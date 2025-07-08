import { useState } from 'react';
import { ChevronDownIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';

export default function Management() {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  // Mock current user role - this will come from auth context
  const currentUserRole = "Owner"; // Owner, Administrator, Director, User

  // Mock user data - this will come from API later
  const mockUsers = [
    {
      id: 1,
      username: "john_doe",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      role: "Administrator",
      atCloudRole: "I'm an @Cloud Leader",
      joinDate: "2025-01-15"
    },
    {
      id: 2,
      username: "jane_smith",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      role: "Director",
      atCloudRole: "Regular Participant",
      joinDate: "2025-02-01"
    },
    {
      id: 3,
      username: "bob_wilson",
      firstName: "Bob",
      lastName: "Wilson",
      email: "bob@example.com",
      role: "User",
      atCloudRole: "Regular Participant",
      joinDate: "2025-03-10"
    }
  ];

  const handlePromoteUser = (userId: number, newRole: string) => {
    console.log(`Promoting user ${userId} to ${newRole}`);
    setOpenDropdown(null);
    // Handle promotion logic here
  };

  const handleDemoteUser = (userId: number, newRole: string) => {
    console.log(`Demoting user ${userId} to ${newRole}`);
    setOpenDropdown(null);
    // Handle demotion logic here
  };

  const handleDeleteUser = (userId: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      console.log(`Deleting user ${userId}`);
      setOpenDropdown(null);
      // Handle deletion logic here
    }
  };

  // Generate actions based on current user role and target user role
  const getActionsForUser = (user: any) => {
    const actions: Array<{
      label: string;
      onClick: () => void;
      className: string;
      disabled?: boolean;
    }> = [];

    // Only Owner can delete users
    if (currentUserRole === "Owner") {
      // Owner can promote/demote anyone
      if (user.role === "User") {
        actions.push(
          {
            label: "Promote to Director",
            onClick: () => handlePromoteUser(user.id, "Director"),
            className: "text-green-600 hover:text-green-900 hover:bg-green-50",
          },
          {
            label: "Promote to Administrator",
            onClick: () => handlePromoteUser(user.id, "Administrator"),
            className: "text-blue-600 hover:text-blue-900 hover:bg-blue-50",
          }
        );
      } else if (user.role === "Director") {
        actions.push(
          {
            label: "Promote to Administrator",
            onClick: () => handlePromoteUser(user.id, "Administrator"),
            className: "text-blue-600 hover:text-blue-900 hover:bg-blue-50",
          },
          {
            label: "Demote to User",
            onClick: () => handleDemoteUser(user.id, "User"),
            className: "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
          }
        );
      } else if (user.role === "Administrator") {
        actions.push(
          {
            label: "Demote to Director",
            onClick: () => handleDemoteUser(user.id, "Director"),
            className: "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
          },
          {
            label: "Demote to User",
            onClick: () => handleDemoteUser(user.id, "User"),
            className: "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
          }
        );
      }
      
      // Owner can delete any user
      actions.push({
        label: "Delete User",
        onClick: () => handleDeleteUser(user.id),
        className: "text-red-600 hover:text-red-900 hover:bg-red-50",
      });
    } else if (currentUserRole === "Administrator") {
      // Administrator can promote Users to Director and demote Directors to User
      if (user.role === "User") {
        actions.push({
          label: "Promote to Director",
          onClick: () => handlePromoteUser(user.id, "Director"),
          className: "text-green-600 hover:text-green-900 hover:bg-green-50",
        });
      } else if (user.role === "Director") {
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
    }

    return actions;
  };

  const toggleDropdown = (userId: number) => {
    setOpenDropdown(openDropdown === userId ? null : userId);
  };

  // Close dropdown when clicking outside
  const handleClickOutside = () => {
    setOpenDropdown(null);
  };

  return (
    <div className="space-y-6" onClick={handleClickOutside}>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">User Management</h1>
        <p className="text-gray-600 mb-6">
          Manage user roles and permissions for your organization.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
        </div>
        
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
                  Role
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
              {mockUsers.map((user) => {
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
                          <div className="text-sm text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'Administrator' ? 'bg-red-100 text-red-800' :
                        user.role === 'Director' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
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
                      <div className="relative">
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
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                            <div className="py-1">
                              {actions.length > 0 ? (
                                actions.map((action, index) => (
                                  <button
                                    key={index}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!action.disabled) {
                                        action.onClick();
                                      }
                                    }}
                                    disabled={action.disabled}
                                    className={`block w-full text-left px-4 py-2 text-sm transition-colors ${action.className} ${
                                      action.disabled ? 'cursor-not-allowed' : 'cursor-pointer'
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
    </div>
  );
}