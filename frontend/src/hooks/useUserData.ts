import { useState, useEffect, useCallback } from "react";
import type { User, SystemAuthorizationLevel } from "../types/management";
import { useUsers } from "../hooks/useUsersApi";
import { userService } from "../services/api";
import toast from "react-hot-toast";

export const useUserData = () => {
  const { users: apiUsers, loading, error, refreshUsers } = useUsers();
  const [users, setUsers] = useState<User[]>([]);

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
        joinDate: user.joinedAt,
        gender: user.gender || "male", // Default to male if not specified
        avatar: user.avatar,
        homeAddress: user.location,
        occupation: "", // Not in API response
        company: "", // Not in API response
        weeklyChurch: "", // Not in API response
        churchAddress: "", // Not in API response
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

        toast.success(`User promoted to ${newRole}`);
        console.log(`User ${userId} promoted to ${newRole}`);
      } catch (error) {
        console.error("Error promoting user:", error);
        toast.error("Failed to promote user");
      }
    },
    []
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

        toast.success(`User role changed to ${newRole}`);
        console.log(`User ${userId} demoted to ${newRole}`);
      } catch (error) {
        console.error("Error changing user role:", error);
        toast.error("Failed to change user role");
      }
    },
    []
  );

  const deleteUser = useCallback(async (userId: string) => {
    try {
      await userService.deleteUser(userId);

      // Update local state
      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));

      toast.success("User deleted successfully");
      console.log(`User ${userId} deleted`);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  }, []);

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
