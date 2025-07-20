import { useState, useEffect, useCallback } from "react";
import type { User, SystemAuthorizationLevel } from "../types/management";
import { useUsers } from "../hooks/useUsersApi";
import { userService } from "../services/api";
// import toast from "react-hot-toast"; // MIGRATED: Replaced with custom notifications
import { useToastReplacement } from "../contexts/NotificationModalContext";

export const useUserData = () => {
  const { users: apiUsers, loading, error, refreshUsers } = useUsers();
  const [users, setUsers] = useState<User[]>([]);
  const notification = useToastReplacement();

  // Convert API users to management User type
  useEffect(() => {
    if (apiUsers.length > 0) {
      const convertedUsers: User[] = apiUsers.map((user) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role as SystemAuthorizationLevel,
        isAtCloudLeader: user.roleInAtCloud ? "Yes" : "No",
        roleInAtCloud: user.roleInAtCloud,
        joinDate: user.joinedAt
          ? new Date(user.joinedAt).toISOString().split("T")[0]
          : "",
        gender: user.gender || "male", // Default to male if not specified
        avatar: user.avatar,
        homeAddress: user.location,
        occupation: (user as any).occupation || "", // Map from API response
        company: (user as any).company || "", // Map from API response
        weeklyChurch: (user as any).weeklyChurch || "", // Map from API response
        churchAddress: (user as any).churchAddress || "", // Map from API response if available
      }));
      setUsers(convertedUsers);
    }
  }, [apiUsers]);

  // User management functions
  const promoteUser = useCallback(
    async (userId: string, newRole: SystemAuthorizationLevel) => {
      try {
        await userService.updateUserRole(userId, newRole);

        // Update local state
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.id === userId ? { ...user, role: newRole } : user
          )
        );

        notification.success(`User promoted to ${newRole}`, {
          title: "Promotion Successful",
        });
      } catch (error) {
        console.error("Error promoting user:", error);
        notification.error("Failed to promote user. Please try again.", {
          title: "Promotion Failed",
        });
      }
    },
    [notification]
  );

  const demoteUser = useCallback(
    async (userId: string, newRole: SystemAuthorizationLevel) => {
      try {
        await userService.updateUserRole(userId, newRole);

        // Update local state
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.id === userId ? { ...user, role: newRole } : user
          )
        );

        notification.success(`User role changed to ${newRole}`, {
          title: "Role Change Successful",
        });
      } catch (error) {
        console.error("Error changing user role:", error);
        notification.error("Failed to change user role. Please try again.", {
          title: "Role Change Failed",
        });
      }
    },
    [notification]
  );

  const deleteUser = useCallback(
    async (userId: string) => {
      try {
        await userService.deleteUser(userId);

        // Update local state
        setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));

        notification.success(
          "User has been permanently deleted from the system.",
          {
            title: "User Deleted Successfully",
            autoCloseDelay: 4000,
          }
        );
      } catch (error) {
        console.error("Error deleting user:", error);
        notification.error(
          "Failed to delete user. Please check your permissions and try again.",
          {
            title: "Deletion Failed",
            autoCloseDelay: 6000,
            actionButton: {
              text: "Retry",
              onClick: () => deleteUser(userId),
              variant: "primary",
            },
          }
        );
      }
    },
    [notification]
  );

  return {
    users,
    loading,
    error,
    refreshUsers,
    promoteUser,
    demoteUser,
    deleteUser,
  };
};
