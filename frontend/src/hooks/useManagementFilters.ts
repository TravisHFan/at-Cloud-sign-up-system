import { useState, useCallback, useRef, useEffect } from "react";
import { useUsers } from "./useUsersApi";
import type { UserSearchFilters } from "../components/management/UserSearchAndFilter";
import { useSocket } from "./useSocket";

export function useManagementFilters() {
  const [currentFilters, setCurrentFilters] = useState<UserSearchFilters>({
    search: "",
    role: undefined,
    gender: undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  // Track last update time to force re-renders when data changes
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Keep track of current filters for pagination
  const currentFiltersRef = useRef(currentFilters);
  currentFiltersRef.current = currentFilters;

  // Prevent auto-fetch from useUsers since we'll handle the initial fetch with filters
  const { users, loading, error, pagination, fetchUsersWithFilters, loadPage } =
    useUsers({ autoFetch: false });

  // Get socket connection for real-time updates
  const { socket } = useSocket({
    authToken: localStorage.getItem("token") || undefined,
  });

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (filters: UserSearchFilters) => {
      setCurrentFilters(filters);

      // Apply filters with page reset to 1
      fetchUsersWithFilters({
        search: filters.search || undefined,
        role: filters.role || undefined,
        gender: filters.gender || undefined,
        sortBy: filters.sortBy || "createdAt",
        sortOrder: filters.sortOrder || "desc",
        page: 1,
      }).then(() => setLastUpdate(Date.now()));
    },
    [fetchUsersWithFilters]
  );

  // Handle page changes with current filters
  const handlePageChange = useCallback(
    (page: number) => {
      const filters = currentFiltersRef.current;
      loadPage(page, {
        search: filters.search || undefined,
        role: filters.role || undefined,
        gender: filters.gender || undefined,
        sortBy: filters.sortBy || "createdAt",
        sortOrder: filters.sortOrder || "desc",
      }).then(() => setLastUpdate(Date.now()));
    },
    [loadPage]
  );

  // Refresh with current filters
  const handleRefresh = useCallback(() => {
    const filters = currentFiltersRef.current;
    fetchUsersWithFilters({
      search: filters.search || undefined,
      role: filters.role || undefined,
      gender: filters.gender || undefined,
      sortBy: filters.sortBy || "createdAt",
      sortOrder: filters.sortOrder || "desc",
      page: pagination.currentPage,
    }).then(() => setLastUpdate(Date.now()));
  }, [fetchUsersWithFilters, pagination.currentPage]);

  // Listen for real-time user updates
  useEffect(() => {
    if (!socket) return;

    const handleUserUpdate = (data: {
      userId: string;
      type: "role_changed" | "status_changed" | "deleted" | "profile_edited";
      user: {
        id: string;
        role?: string;
        avatar?: string;
        phone?: string;
        isAtCloudLeader?: boolean;
        roleInAtCloud?: string;
        isActive?: boolean;
      };
      changes?: Record<string, boolean>;
    }) => {
      console.log("Real-time user update received:", data);
      // Refresh the current page with current filters
      handleRefresh();
    };

    socket.on("user_update", handleUserUpdate);

    return () => {
      socket.off("user_update", handleUserUpdate);
    };
  }, [socket, handleRefresh]);

  // Initialize with default filters on mount
  useEffect(() => {
    handleFiltersChange({
      search: "",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  }, [handleFiltersChange]); // Include handleFiltersChange dependency

  return {
    users,
    loading,
    error,
    pagination,
    currentFilters,
    lastUpdate,
    handleFiltersChange,
    handlePageChange,
    handleRefresh,
  };
}
