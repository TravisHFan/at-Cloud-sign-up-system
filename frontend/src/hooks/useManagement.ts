import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import type { SystemAuthorizationLevel, User } from "../types/management";
import { useUserData } from "./useUserData";
import { useRoleStats } from "./useRoleStats";
import { useUserPermissions } from "./useUserPermissions";
import { useNotifications } from "../contexts/NotificationContext";
import { useAuth } from "./useAuth";
import { MANAGEMENT_CONFIG } from "../config/managementConstants";

// Types for confirmation modal
interface ConfirmationAction {
  type: "promote" | "demote" | "delete";
  user: User;
  newRole?: SystemAuthorizationLevel;
  title: string;
  message: string;
  confirmText: string;
  actionType: "danger" | "warning" | "info";
}

export function useManagement() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get current user and notification context
  const { currentUser } = useAuth();
  const { addRoleChangeSystemMessage } = useNotifications();

  // Get actual current user role from auth context
  const currentUserRole: SystemAuthorizationLevel =
    currentUser?.role || "Participant";

  // Use existing hooks for user data management
  const { users, promoteUser, demoteUser, deleteUser } = useUserData();
  const roleStats = useRoleStats(users);

  // Handle user actions with confirmation dialogs
  const showPromoteConfirmation = (
    user: User,
    newRole: SystemAuthorizationLevel
  ) => {
    const roleHierarchy = {
      Participant: "Participant",
      Leader: "Leader",
      Administrator: "Administrator",
      "Super Admin": "Super Admin",
    };

    setConfirmationAction({
      type: "promote",
      user,
      newRole,
      title: "Confirm Role Promotion",
      message: `Are you sure you want to promote ${user.firstName} ${
        user.lastName
      } from ${roleHierarchy[user.role]} to ${
        roleHierarchy[newRole]
      }?\n\nThis action will:\n• Grant ${
        user.firstName
      } additional permissions\n• Change their access level in the system\n• Notify them of their new role`,
      confirmText: `Promote to ${roleHierarchy[newRole]}`,
      actionType: "info",
    });
    setOpenDropdown(null);
  };

  const showDemoteConfirmation = (
    user: User,
    newRole: SystemAuthorizationLevel
  ) => {
    const roleHierarchy = {
      Participant: "Participant",
      Leader: "Leader",
      Administrator: "Administrator",
      "Super Admin": "Super Admin",
    };

    setConfirmationAction({
      type: "demote",
      user,
      newRole,
      title: "Confirm Role Demotion",
      message: `Are you sure you want to demote ${user.firstName} ${
        user.lastName
      } from ${roleHierarchy[user.role]} to ${
        roleHierarchy[newRole]
      }?\n\nThis action will:\n• Remove some of ${
        user.firstName
      }'s current permissions\n• Restrict their access level in the system\n• Notify them of their role change`,
      confirmText: `Demote to ${roleHierarchy[newRole]}`,
      actionType: "warning",
    });
    setOpenDropdown(null);
  };

  const showDeleteConfirmation = (user: User) => {
    setConfirmationAction({
      type: "delete",
      user,
      title: "Confirm User Deletion",
      message: `Are you sure you want to permanently delete ${user.firstName} ${user.lastName}?\n\nThis action will:\n• Permanently remove their account\n• Delete all their data and activity history\n• Remove them from all events and conversations\n• Cannot be undone\n\nPlease type the user's full name to confirm this irreversible action.`,
      confirmText: "Delete User",
      actionType: "danger",
    });
    setOpenDropdown(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmationAction) return;

    setIsProcessing(true);

    try {
      // Simulate processing delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { user } = confirmationAction;
      const fullName = `${user.firstName} ${user.lastName}`;

      switch (confirmationAction.type) {
        case "promote":
          if (confirmationAction.newRole) {
            const oldRole = confirmationAction.user.role;
            promoteUser(confirmationAction.user.id, confirmationAction.newRole);

            // Add system message for auth level change
            if (currentUser) {
              addRoleChangeSystemMessage({
                targetUserName: `${user.firstName} ${user.lastName}`,
                targetUserId: user.id,
                fromSystemAuthLevel: oldRole,
                toSystemAuthLevel: confirmationAction.newRole,
                actorUserId: currentUser.id,
                actorName: `${currentUser.firstName} ${currentUser.lastName}`,
              });
            }

            toast.success(
              `${fullName} has been successfully promoted to ${confirmationAction.newRole}!`,
              {
                duration: 4000,
                icon: "⬆️",
              }
            );
          }
          break;
        case "demote":
          if (confirmationAction.newRole) {
            const oldRole = confirmationAction.user.role;
            demoteUser(confirmationAction.user.id, confirmationAction.newRole);

            // Add system message for auth level change
            if (currentUser) {
              addRoleChangeSystemMessage({
                targetUserName: `${user.firstName} ${user.lastName}`,
                targetUserId: user.id,
                fromSystemAuthLevel: oldRole,
                toSystemAuthLevel: confirmationAction.newRole,
                actorUserId: currentUser.id,
                actorName: `${currentUser.firstName} ${currentUser.lastName}`,
              });
            }

            toast.success(
              `${fullName} has been demoted to ${confirmationAction.newRole}.`,
              {
                duration: 4000,
                icon: "⬇️",
              }
            );
          }
          break;
        case "delete":
          deleteUser(confirmationAction.user.id);
          toast.success(
            `${fullName} has been permanently deleted from the system.`,
            {
              duration: 5000,
              icon: "🗑️",
            }
          );
          break;
      }
    } catch (error) {
      console.error("Management action failed:", error);
      toast.error("Action failed. Please try again.", {
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
      setConfirmationAction(null);
    }
  };

  const handleCancelConfirmation = () => {
    setConfirmationAction(null);
    setIsProcessing(false);
  };

  // Legacy handlers - replaced with confirmation dialogs
  const handlePromoteUser = (
    userId: string,
    newRole: SystemAuthorizationLevel
  ) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      showPromoteConfirmation(user, newRole);
    }
  };

  const handleDemoteUser = (
    userId: string,
    newRole: SystemAuthorizationLevel
  ) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      showDemoteConfirmation(user, newRole);
    }
  };

  const handleDeleteUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      showDeleteConfirmation(user);
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

    // Confirmation modal state
    confirmationAction,
    isProcessing,
    handleConfirmAction,
    handleCancelConfirmation,
  };
}
