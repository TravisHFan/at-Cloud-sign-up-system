import { useState, useEffect } from "react";
import type { SystemRole } from "../types/management";
import { useUserData } from "../hooks/useUserData";
import { useRoleStats } from "../hooks/useRoleStats";
import { useUserPermissions } from "../hooks/useUserPermissions";
import ManagementHeader from "../components/management/ManagementHeader";
import UserTable from "../components/management/UserTable";

export default function Management() {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  // Mock current user role - this will come from auth context
  const currentUserRole: SystemRole = "Super Admin";

  // Use the custom hook for user data management
  const { users, promoteUser, demoteUser, deleteUser } = useUserData();

  // Use the custom hook for role statistics
  const roleStats = useRoleStats(users);

  // Handle user actions with dropdown closing
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

  // Use the custom hook for user permissions
  const { getActionsForUser } = useUserPermissions(
    currentUserRole,
    handlePromoteUser,
    handleDemoteUser,
    handleDeleteUser
  );

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

  const toggleDropdown = (userId: number) => {
    setOpenDropdown(openDropdown === userId ? null : userId);
  };

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
