import { useState, useCallback, useRef, useEffect } from "react";
import { useUsers } from "./useUsersApi";
import type { UserSearchFilters } from "../components/management/UserSearchAndFilter";
import { useSocket } from "./useSocket";
import { socketService } from "../services/socketService";

export function useManagementFilters() {
  const [currentFilters, setCurrentFilters] = useState<UserSearchFilters>({
    search: "",
    role: undefined,
    gender: undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  // Keep track of current filters for pagination
  const currentFiltersRef = useRef(currentFilters);
  currentFiltersRef.current = currentFilters;

  // Prevent auto-fetch from useUsers since we'll handle the initial fetch with filters
  const { users, loading, error, pagination, fetchUsersWithFilters, loadPage } =
    useUsers({ autoFetch: false });

  // Get socket connection for real-time updates
  useSocket();

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
      });
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
      });
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
    });
  }, [fetchUsersWithFilters, pagination.currentPage]);

  // Listen for real-time user updates
  useEffect(() => {
    const handleUserUpdate = () => {
      // Refresh the current page with current filters
      handleRefresh();
    };

    return socketService.on("user_update", handleUserUpdate);
  }, [handleRefresh]);

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
    handleFiltersChange,
    handlePageChange,
    handleRefresh,
  };
}
