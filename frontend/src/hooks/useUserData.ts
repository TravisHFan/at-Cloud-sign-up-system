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

        toast.success(`User promoted to ${newRole}`);
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
