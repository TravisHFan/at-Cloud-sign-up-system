import { useManagement } from "../hooks/useManagement";
import ManagementHeader from "../components/management/ManagementHeader";
import UserTable from "../components/management/UserTable";

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
    <div className="space-y-6">
      {/* Header Section with Statistics */}
      <ManagementHeader
        currentUserRole={currentUserRole}
        roleStats={roleStats}
      />

      {/* User Management Table */}
      <UserTable
        users={users}
        getActionsForUser={getActionsForUser}
        openDropdown={openDropdown}
        onToggleDropdown={toggleDropdown}
      />
    </div>
  );
}
