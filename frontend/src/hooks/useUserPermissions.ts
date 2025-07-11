import { useMemo } from "react";
import type {
  User,
  SystemAuthorizationLevel,
  UserAction,
} from "../types/management";

interface UserPermissionsHook {
  getActionsForUser: (user: User) => UserAction[];
  canPromoteUser: (user: User) => boolean;
  canDemoteUser: (user: User) => boolean;
  canDeleteUser: (user: User) => boolean;
}

export const useUserPermissions = (
  currentUserRole: SystemAuthorizationLevel,
  onPromoteUser: (userId: string, newRole: SystemAuthorizationLevel) => void,
  onDemoteUser: (userId: string, newRole: SystemAuthorizationLevel) => void,
  onDeleteUser: (userId: string) => void
): UserPermissionsHook => {
  // Memoize permission check functions
  const permissionChecks = useMemo(
    () => ({
      canPromoteUser: (user: User): boolean => {
        if (currentUserRole === "Super Admin") {
          return user.role !== "Super Admin"; // Can promote anyone except Super Admin
        } else if (currentUserRole === "Administrator") {
          return user.role === "Participant"; // Can only promote Participants to Leader
        }
        return false;
      },

      canDemoteUser: (user: User): boolean => {
        if (currentUserRole === "Super Admin") {
          return user.role !== "Super Admin" && user.role !== "Participant"; // Changed from "User"
        } else if (currentUserRole === "Administrator") {
          return user.role === "Leader";
        }
        return false;
      },

      canDeleteUser: (user: User): boolean => {
        return currentUserRole === "Super Admin" && user.role !== "Super Admin";
      },

      canModifyUser: (user: User): boolean => {
        if (currentUserRole === "Super Admin") {
          return user.role !== "Super Admin"; // Can modify anyone except Super Admin
        } else if (currentUserRole === "Administrator") {
          return user.role !== "Administrator"; // Cannot modify other Administrators
        }
        return false; // Leaders and Users cannot modify anyone
      },
    }),
    [currentUserRole]
  );

  // Generate actions based on permissions
  const getActionsForUser = useMemo(
    () =>
      (user: User): UserAction[] => {
        const actions: UserAction[] = [];

        // If user cannot be modified at all, show "No Actions Available"
        if (!permissionChecks.canModifyUser(user)) {
          actions.push({
            label: "No Actions Available",
            onClick: () => {},
            className: "text-gray-400 cursor-not-allowed",
            disabled: true,
          });
          return actions;
        }

        // Super Admin permissions
        if (currentUserRole === "Super Admin") {
          if (user.role === "Participant") {
            actions.push(
              {
                label: "Promote to Leader",
                onClick: () => onPromoteUser(user.id, "Leader"),
                className:
                  "text-green-600 hover:text-green-900 hover:bg-green-50",
              },
              {
                label: "Promote to Administrator",
                onClick: () => onPromoteUser(user.id, "Administrator"),
                className: "text-blue-600 hover:text-blue-900 hover:bg-blue-50",
              }
            );
          } else if (user.role === "Leader") {
            actions.push(
              {
                label: "Promote to Administrator",
                onClick: () => onPromoteUser(user.id, "Administrator"),
                className: "text-blue-600 hover:text-blue-900 hover:bg-blue-50",
              },
              {
                label: "Demote to Participant", // Changed from "Demote to User"
                onClick: () => onDemoteUser(user.id, "Participant"), // Changed from "User"
                className:
                  "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
              }
            );
          } else if (user.role === "Administrator") {
            actions.push(
              {
                label: "Demote to Leader",
                onClick: () => onDemoteUser(user.id, "Leader"),
                className:
                  "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
              },
              {
                label: "Demote to Participant", // Changed from "Demote to User"
                onClick: () => onDemoteUser(user.id, "Participant"), // Changed from "User"
                className:
                  "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
              }
            );
          }

          // Super Admin can delete users
          if (permissionChecks.canDeleteUser(user)) {
            actions.push({
              label: "Delete User",
              onClick: () => onDeleteUser(user.id),
              className: "text-red-600 hover:text-red-900 hover:bg-red-50",
            });
          }
        }

        // Administrator permissions
        else if (currentUserRole === "Administrator") {
          if (user.role === "Participant") {
            actions.push({
              label: "Promote to Leader",
              onClick: () => onPromoteUser(user.id, "Leader"),
              className:
                "text-green-600 hover:text-green-900 hover:bg-green-50",
            });
          } else if (user.role === "Leader") {
            actions.push({
              label: "Demote to Participant", // Changed from "Demote to User"
              onClick: () => onDemoteUser(user.id, "Participant"), // Changed from "User"
              className:
                "text-orange-600 hover:text-orange-900 hover:bg-orange-50",
            });
          }
        }

        // If no actions were added, show "No Actions Available"
        if (actions.length === 0) {
          actions.push({
            label: "No Actions Available",
            onClick: () => {},
            className: "text-gray-400 cursor-not-allowed",
            disabled: true,
          });
        }

        return actions;
      },
    [
      currentUserRole,
      permissionChecks,
      onPromoteUser,
      onDemoteUser,
      onDeleteUser,
    ]
  );

  return {
    getActionsForUser,
    canPromoteUser: permissionChecks.canPromoteUser,
    canDemoteUser: permissionChecks.canDemoteUser,
    canDeleteUser: permissionChecks.canDeleteUser,
  };
};
