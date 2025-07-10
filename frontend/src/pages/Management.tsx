import { useManagement } from "../hooks/useManagement";
import ManagementHeader from "../components/management/ManagementHeader";
import UserTable from "../components/management/UserTable";
import { Card, CardContent } from "../components/ui";

export default function Management() {
  const {
    // User data
    users,
    currentUserRole,
    roleStats,

    // Dropdown state
    openDropdown,
    toggleDropdown,

    // User actions
    getActionsForUser,
  } = useManagement();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section with Statistics */}
      <ManagementHeader
        currentUserRole={currentUserRole}
        roleStats={roleStats}
      />

      {/* User Management Table */}
      <Card>
        <CardContent>
          <UserTable
            users={users}
            getActionsForUser={getActionsForUser}
            openDropdown={openDropdown}
            onToggleDropdown={toggleDropdown}
          />
        </CardContent>
      </Card>
    </div>
  );
}
