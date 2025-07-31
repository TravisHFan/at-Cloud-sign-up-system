import { useState, useEffect } from "react";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import type { SystemAuthorizationLevel, User } from "../types/management";
import { useUserData } from "./useUserData";
import { useRoleStats } from "./useRoleStats";
import { useUserPermissions } from "./useUserPermissions";
import { useNotifications } from "../contexts/NotificationContext";
import { useAuth } from "./useAuth";
import { MANAGEMENT_CONFIG } from "../config/managementConstants";

// Types for confirmation modal
interface ConfirmationAction {
  type: "promote" | "demote" | "delete" | "deactivate" | "reactivate";
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
  const notification = useToastReplacement();

  // Get actual current user role from auth context
  const currentUserRole: SystemAuthorizationLevel =
    currentUser?.role || "Participant";

  // Use existing hooks for user data management
  const {
    users,
    promoteUser,
    demoteUser,
    deleteUser,
    deactivateUser,
    reactivateUser,
  } = useUserData();
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

  const showDeactivateConfirmation = (user: User) => {
    setConfirmationAction({
      type: "deactivate",
      user,
      title: "Confirm User Deactivation",
      message: `Are you sure you want to deactivate ${user.firstName} ${user.lastName}?\n\nThis action will:\n• Prevent them from logging in\n• Keep all their data and activity history intact\n• Maintain their role and permissions for when reactivated\n• Can be reversed by reactivating the user`,
      confirmText: "Deactivate User",
      actionType: "warning",
    });
    setOpenDropdown(null);
  };

  const showReactivateConfirmation = (user: User) => {
    setConfirmationAction({
      type: "reactivate",
      user,
      title: "Confirm User Reactivation",
      message: `Are you sure you want to reactivate ${user.firstName} ${user.lastName}?\n\nThis action will:\n• Allow them to log in again\n• Restore their access to all features\n• Maintain their existing role and permissions\n• Grant them full system access based on their role`,
      confirmText: "Reactivate User",
      actionType: "info",
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

            notification.success(
              `${fullName} has been successfully promoted to ${confirmationAction.newRole}!`,
              {
                title: "User Promoted",
                autoCloseDelay: 4000,
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

            notification.success(
              `${fullName} has been demoted to ${confirmationAction.newRole}.`,
              {
                title: "User Demoted",
                autoCloseDelay: 4000,
              }
            );
          }
          break;
        case "delete":
          deleteUser(confirmationAction.user.id);
          notification.success(
            `${fullName} has been permanently deleted from the system.`,
            {
              title: "User Deleted",
              autoCloseDelay: 5000,
            }
          );
          break;
        case "deactivate":
          deactivateUser(confirmationAction.user.id);
          notification.success(
            `${fullName} has been deactivated and can no longer log in.`,
            {
              title: "User Deactivated",
              autoCloseDelay: 4000,
            }
          );
          break;
        case "reactivate":
          reactivateUser(confirmationAction.user.id);
          notification.success(
            `${fullName} has been reactivated and can now log in.`,
            {
              title: "User Reactivated",
              autoCloseDelay: 4000,
            }
          );
          break;
      }
    } catch (error) {
      console.error("Management action failed:", error);
      notification.error(
        "The management action could not be completed. Please check your permissions and try again.",
        {
          title: "Action Failed",
          autoCloseDelay: 5000,
          actionButton: {
            text: "Retry",
            onClick: () => {
              if (confirmationAction) {
                handleConfirmAction();
              }
            },
            variant: "primary",
          },
        }
      );
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

  const handleDeactivateUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      showDeactivateConfirmation(user);
    }
  };

  const handleReactivateUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      showReactivateConfirmation(user);
    }
  };

  // Get user permissions actions
  const { getActionsForUser } = useUserPermissions(
    currentUserRole,
    handlePromoteUser,
    handleDemoteUser,
    handleDeleteUser,
    handleDeactivateUser,
    handleReactivateUser
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
    handleDeactivateUser,
    handleReactivateUser,

    // Confirmation modal state
    confirmationAction,
    isProcessing,
    handleConfirmAction,
    handleCancelConfirmation,
  };
}
