import { useState, useEffect } from "react";
import type { SystemRole } from "../types/management";
import { useUserData } from "./useUserData";
import { useRoleStats } from "./useRoleStats";
import { useUserPermissions } from "./useUserPermissions";
import { MANAGEMENT_CONFIG } from "../config/managementConstants";

export function useManagement() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Mock current user role - this will come from auth context
  const currentUserRole: SystemRole = "Super Admin";

  // Use existing hooks for user data management
  const { users, promoteUser, demoteUser, deleteUser } = useUserData();
  const roleStats = useRoleStats(users);

  // Handle user actions with dropdown closing
  const handlePromoteUser = (userId: string, newRole: SystemRole) => {
    promoteUser(userId, newRole);
    setOpenDropdown(null);
  };

  const handleDemoteUser = (userId: string, newRole: SystemRole) => {
    demoteUser(userId, newRole);
    setOpenDropdown(null);
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm(MANAGEMENT_CONFIG.confirmDeleteMessage)) {
      deleteUser(userId);
      setOpenDropdown(null);
    }
  };

  // Get user permissions actions
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
      if (!target.closest(`.${MANAGEMENT_CONFIG.dropdownContainerClass}`)) {
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

  const toggleDropdown = (userId: string) => {
    setOpenDropdown(openDropdown === userId ? null : userId);
  };

  return {
    // User data
    users,
    currentUserRole,
    roleStats,

    // Dropdown state
    openDropdown,
    toggleDropdown,

    // User actions
    getActionsForUser,

    // Direct actions (if needed)
    handlePromoteUser,
    handleDemoteUser,
    handleDeleteUser,
  };
}
