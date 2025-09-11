import { useState, useEffect, useCallback } from "react";
import type { User, SystemAuthorizationLevel } from "../types/management";
import { useUsers } from "../hooks/useUsersApi";
import { userService } from "../services/api";
import { useToastReplacement } from "../contexts/NotificationModalContext";

export const useUserData = (options?: {
  fetchAll?: boolean;
  limit?: number;
  suppressErrors?: boolean;
}) => {
  const {
    users: apiUsers,
    loading,
    error,
    refreshUsers,
    pagination,
    loadPage,
  } = useUsers({ suppressErrors: options?.suppressErrors });
  const [users, setUsers] = useState<User[]>([]);
  const [fetchingAll, setFetchingAll] = useState(false);
  const notification = useToastReplacement();

  // Convert API users to management User type (skip when aggregating all pages)
  useEffect(() => {
    if (options?.fetchAll) return; // avoid clobbering aggregated results
    if (apiUsers.length > 0) {
      const convertedUsers: User[] = apiUsers.map((user) => {
        const isLeaderFlag = (user as { isAtCloudLeader?: boolean })
          .isAtCloudLeader;
        const occupation = (user as { occupation?: string }).occupation;
        const company = (user as { company?: string }).company;
        const weeklyChurch = (user as { weeklyChurch?: string }).weeklyChurch;
        const churchAddress = (user as { churchAddress?: string })
          .churchAddress;

        return {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone, // Include phone field from API
          role: user.role as SystemAuthorizationLevel,
          // Prefer backend boolean flag; fallback to roleInAtCloud presence
          isAtCloudLeader:
            isLeaderFlag !== undefined
              ? isLeaderFlag
                ? "Yes"
                : "No"
              : user.roleInAtCloud
              ? "Yes"
              : "No",
          roleInAtCloud: user.roleInAtCloud,
          joinDate: user.joinedAt
            ? new Date(user.joinedAt).toISOString().split("T")[0]
            : "",
          gender: user.gender || "male", // Default to male if not specified
          avatar: user.avatar,
          homeAddress: user.location,
          occupation: occupation || "",
          company: company || "",
          weeklyChurch: weeklyChurch || "",
          churchAddress: churchAddress || "",
          isActive: user.isActive !== false, // Default to true if not specified
        };
      });
      setUsers(convertedUsers);
    }
  }, [apiUsers, options?.fetchAll]);

  // Optionally fetch ALL users across pages (for Analytics)
  useEffect(() => {
    if (!options?.fetchAll) return;

    let cancelled = false;
    const run = async () => {
      try {
        setFetchingAll(true);
        const limit = options.limit ?? 100;
        let page = 1;
        // Define a minimal backend user shape for typing
        interface BackendUserBase {
          id: string;
          username: string;
          email: string;
          firstName?: string | null;
          lastName?: string | null;
          role: string;
          roleInAtCloud?: string | null;
          joinedAt?: string | null;
          avatar?: string | null;
          gender?: "male" | "female" | null;
          phone?: string | null;
          location?: string | null;
          isActive?: boolean | null;
        }

        interface BackendUser extends BackendUserBase {
          isAtCloudLeader?: boolean | null;
          occupation?: string | null;
          company?: string | null;
          weeklyChurch?: string | null;
          churchAddress?: string | null;
        }

        let allUsers: BackendUser[] = [];
        // Fetch pages until hasNext is false
        // Request page explicitly to be deterministic in tests and prod
        while (true) {
          const resp = (await userService.getUsers({
            page,
            limit,
          })) as unknown as {
            users: BackendUser[];
            pagination: {
              currentPage: number;
              totalPages: number;
              totalUsers: number;
              hasNext: boolean;
              hasPrev: boolean;
            };
          };
          if (resp && Array.isArray(resp.users)) {
            allUsers = allUsers.concat(resp.users);
          }
          const hasNext: boolean = !!resp.pagination?.hasNext;
          if (!hasNext) break;
          page += 1;
        }

        if (cancelled) return;

        // Convert to management User[] (duplicate of mapping above to avoid refactor)
        const convertedUsers: User[] = allUsers.map((user) => {
          const isLeaderFlag = (user as { isAtCloudLeader?: boolean })
            .isAtCloudLeader;
          const occupation = (user as { occupation?: string }).occupation;
          const company = (user as { company?: string }).company;
          const weeklyChurch = (user as { weeklyChurch?: string }).weeklyChurch;
          const churchAddress = (user as { churchAddress?: string })
            .churchAddress;

          return {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role as SystemAuthorizationLevel,
            isAtCloudLeader:
              isLeaderFlag !== undefined
                ? isLeaderFlag
                  ? "Yes"
                  : "No"
                : user.roleInAtCloud
                ? "Yes"
                : "No",
            roleInAtCloud: user.roleInAtCloud,
            joinDate: user.joinedAt
              ? new Date(user.joinedAt).toISOString().split("T")[0]
              : "",
            gender: user.gender || "male",
            avatar: user.avatar,
            homeAddress: user.location,
            occupation: occupation || "",
            company: company || "",
            weeklyChurch: weeklyChurch || "",
            churchAddress: churchAddress || "",
            isActive: user.isActive !== false,
          } as User;
        });

        setUsers(convertedUsers);
      } catch (e) {
        console.error("Error fetching all users for analytics:", e);
      } finally {
        if (!cancelled) setFetchingAll(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [options?.fetchAll, options?.limit]);

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

        notification.success(
          `User System Authorization Level changed to ${newRole}`,
          {
            title: "Role Change Successful",
          }
        );
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

  const deactivateUser = useCallback(
    async (userId: string) => {
      try {
        await userService.deactivateUser(userId);

        // Update local state
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.id === userId ? { ...user, isActive: false } : user
          )
        );

        notification.success("User has been deactivated successfully.", {
          title: "User Deactivated",
          autoCloseDelay: 4000,
        });
      } catch (error) {
        console.error("Error deactivating user:", error);
        notification.error(
          "Failed to deactivate user. Please check your permissions and try again.",
          {
            title: "Deactivation Failed",
            autoCloseDelay: 6000,
            actionButton: {
              text: "Retry",
              onClick: () => deactivateUser(userId),
              variant: "primary",
            },
          }
        );
      }
    },
    [notification]
  );

  const reactivateUser = useCallback(
    async (userId: string) => {
      try {
        await userService.reactivateUser(userId);

        // Update local state
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.id === userId ? { ...user, isActive: true } : user
          )
        );

        notification.success("User has been reactivated successfully.", {
          title: "User Reactivated",
          autoCloseDelay: 4000,
        });
      } catch (error) {
        console.error("Error reactivating user:", error);
        notification.error(
          "Failed to reactivate user. Please check your permissions and try again.",
          {
            title: "Reactivation Failed",
            autoCloseDelay: 6000,
            actionButton: {
              text: "Retry",
              onClick: () => reactivateUser(userId),
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
    loading: loading || fetchingAll,
    error,
    refreshUsers,
    pagination,
    loadPage,
    promoteUser,
    demoteUser,
    deleteUser,
    deactivateUser,
    reactivateUser,
  };
};
