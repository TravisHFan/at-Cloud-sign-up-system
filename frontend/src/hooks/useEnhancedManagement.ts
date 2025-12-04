import { useMemo } from "react";
import type { SystemAuthorizationLevel, User } from "../types/management";
import { useRoleStats } from "./useRoleStats";
import { useUserStats } from "./useUsersApi";
import { useAuth } from "./useAuth";
import { useManagementFilters } from "./useManagementFilters";

/**
 * Enhanced management hook that combines search/filter functionality
 * with the existing management capabilities.
 */
export function useEnhancedManagement() {
  // Get current user
  const { currentUser } = useAuth();

  // Get actual current user role from auth context
  const currentUserRole: SystemAuthorizationLevel =
    currentUser?.role || "Participant";

  // Use the enhanced filtering hook for user data
  const {
    users: filteredUsers,
    loading: filterLoading,
    error: filterError,
    pagination: filterPagination,
    currentFilters,
    handleFiltersChange,
    handlePageChange,
    handleRefresh,
  } = useManagementFilters();

  // Convert filtered users to management User type
  const users: User[] = useMemo(() => {
    return filteredUsers.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as SystemAuthorizationLevel,
      avatar: user.avatar || null,
      gender: user.gender || "male",
      joinDate: user.joinedAt
        ? new Date(user.joinedAt).toLocaleDateString()
        : "Unknown",
      lastActive: user.lastActive || null,
      isActive: user.isActive !== false,
      emailVerified: user.emailVerified || false,
      roleInAtCloud: user.roleInAtCloud || undefined,
      // Include both formats for compatibility
      isAtCloudLeader: user.isAtCloudLeader ? "Yes" : "No",
    }));
  }, [filteredUsers]);

  // Page-derived stats (fallback)
  const pageRoleStats = useRoleStats(users);

  // Determine if user has permission to view system analytics
  const canViewSystemAnalytics =
    currentUserRole === "Super Admin" ||
    currentUserRole === "Administrator" ||
    currentUserRole === "Leader";

  // Backend-wide stats for the whole collection (fetch for all Community page users)
  const { stats: backendStats, loading: backendStatsLoading } = useUserStats(
    canViewSystemAnalytics
  );

  // Map backend stats shape to RoleStats for UI cards; fallback to page stats while loading
  const roleStats = useMemo(() => {
    type BackendRoleDistribution = Record<
      | "Super Admin"
      | "Administrator"
      | "Leader"
      | "Guest Expert"
      | "Participant",
      number
    > &
      Record<string, number>;
    interface BackendUserStats {
      totalUsers: number;
      atCloudLeaders: number;
      roleDistribution: BackendRoleDistribution;
    }
    const fromPossibles = (obj: unknown): BackendUserStats | null => {
      const stats =
        (obj as { stats?: unknown })?.stats ||
        (obj as { data?: { stats?: unknown } })?.data?.stats ||
        null;
      if (!stats || typeof stats !== "object") return null;
      const s = stats as Partial<BackendUserStats>;
      if (!s.roleDistribution) return null;
      return {
        totalUsers: Number(s.totalUsers ?? 0),
        atCloudLeaders: Number(s.atCloudLeaders ?? 0),
        roleDistribution: s.roleDistribution as BackendRoleDistribution,
      };
    };

    const normalized = fromPossibles(backendStats);
    if (!normalized) return pageRoleStats;

    const roleDist = normalized.roleDistribution;
    return {
      total: normalized.totalUsers,
      superAdmin: roleDist["Super Admin"] || 0,
      administrators: roleDist["Administrator"] || 0,
      leaders: roleDist["Leader"] || 0,
      guestExperts: roleDist["Guest Expert"] || 0,
      participants: roleDist["Participant"] || 0,
      atCloudLeaders: normalized.atCloudLeaders,
    };
  }, [backendStats, pageRoleStats]);

  return {
    // User data
    users,
    currentUserRole,
    roleStats,
    roleStatsLoading: backendStatsLoading,
    pagination: filterPagination,
    loading: filterLoading,
    error: filterError,

    // Search and filtering
    currentFilters,
    onFiltersChange: handleFiltersChange,
    onPageChange: handlePageChange,
    onRefresh: handleRefresh,
  };
}
