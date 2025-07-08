export default function Management() {
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
    // Handle promotion logic here
  };

  const handleDemoteUser = (userId: number, newRole: string) => {
    console.log(`Demoting user ${userId} to ${newRole}`);
    // Handle demotion logic here
  };

  const handleDeleteUser = (userId: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      console.log(`Deleting user ${userId}`);
      // Handle deletion logic here
    }
  };

  return (
    <div className="space-y-6">
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
              {mockUsers.map((user) => (
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {user.role === 'User' && (
                      <>
                        <button
                          onClick={() => handlePromoteUser(user.id, 'Director')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Promote to Director
                        </button>
                        <button
                          onClick={() => handlePromoteUser(user.id, 'Administrator')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Promote to Admin
                        </button>
                      </>
                    )}
                    {user.role === 'Director' && (
                      <>
                        <button
                          onClick={() => handlePromoteUser(user.id, 'Administrator')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Promote to Admin
                        </button>
                        <button
                          onClick={() => handleDemoteUser(user.id, 'User')}
                          className="text-orange-600 hover:text-orange-900"
                        >
                          Demote to User
                        </button>
                      </>
                    )}
                    {user.role === 'Administrator' && (
                      <>
                        <button
                          onClick={() => handleDemoteUser(user.id, 'Director')}
                          className="text-orange-600 hover:text-orange-900"
                        >
                          Demote to Director
                        </button>
                        <button
                          onClick={() => handleDemoteUser(user.id, 'User')}
                          className="text-orange-600 hover:text-orange-900"
                        >
                          Demote to User
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}