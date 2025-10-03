import { useState, useCallback, useRef, useEffect } from "react";
import { useUsers } from "./useUsersApi";
import type { UserSearchFilters } from "../components/management/UserSearchAndFilter";

export function useManagementFilters() {
  const [currentFilters, setCurrentFilters] = useState<UserSearchFilters>({
    search: "",
    role: undefined,
    gender: undefined,
    sortBy: "role",
    sortOrder: "asc",
  });

  // Keep track of current filters for pagination
  const currentFiltersRef = useRef(currentFilters);
  currentFiltersRef.current = currentFilters;

  const { users, loading, error, pagination, fetchUsersWithFilters, loadPage } =
    useUsers();

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (filters: UserSearchFilters) => {
      setCurrentFilters(filters);

      // Apply filters with page reset to 1
      fetchUsersWithFilters({
        search: filters.search || undefined,
        role: filters.role || undefined,
        gender: filters.gender || undefined,
        sortBy: filters.sortBy || "role",
        sortOrder: filters.sortOrder || "asc",
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
        sortBy: filters.sortBy || "role",
        sortOrder: filters.sortOrder || "asc",
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
      sortBy: filters.sortBy || "role",
      sortOrder: filters.sortOrder || "asc",
      page: pagination.currentPage,
    });
  }, [fetchUsersWithFilters, pagination.currentPage]);

  // Initialize with default filters on mount
  useEffect(() => {
    handleFiltersChange({
      search: "",
      sortBy: "role",
      sortOrder: "asc",
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
