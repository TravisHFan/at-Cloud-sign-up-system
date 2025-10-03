import { useState, useEffect, useCallback } from "react";
import { userService } from "../services/api";
import { useToastReplacement } from "../contexts/NotificationModalContext";

// Backend response shapes we actually consume in this hook
interface BackendUserBase {
  id: string;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  roleInAtCloud?: string | null;
  lastLogin?: string | null;
  createdAt?: string | null;
  joinedAt?: string | null;
  // Optional profile details
  avatar?: string | null;
  gender?: "male" | "female" | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  location?: string | null;
  bio?: string | null;
  emailVerified?: boolean | null;
}

interface BackendUser extends BackendUserBase {
  // Admin list specific extras (optional in API, used where available)
  isAtCloudLeader?: boolean | null;
  lastActive?: string | null;
  isActive?: boolean | null;
  // Analytics extras (only in list)
  occupation?: string | null;
  company?: string | null;
  weeklyChurch?: string | null;
  churchAddress?: string | null;
}

interface BackendUsersResponse {
  users: BackendUser[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  systemAuthorizationLevel: string;
  // Backend boolean flag; used by management mapping to display "Yes"/"No"
  isAtCloudLeader?: boolean;
  roleInAtCloud?: string;
  avatar?: string;
  gender?: "male" | "female";
  phone?: string;
  dateOfBirth?: string;
  location?: string;
  bio?: string;
  joinedAt: string;
  lastActive?: string;
  isActive?: boolean;
  emailVerified?: boolean;
}

export interface UseUserProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
}

export function useUserProfile(): UseUserProfileReturn {
  const { success, error: showError } = useToastReplacement();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response =
        (await userService.getProfile()) as unknown as BackendUserBase;

      // Convert backend user format to frontend UserProfile format
      const convertedProfile: UserProfile = {
        id: response.id,
        username: response.username,
        email: response.email,
        firstName: response.firstName ?? "",
        lastName: response.lastName ?? "",
        role: response.role,
        systemAuthorizationLevel: response.role, // Use role as system authorization level
        roleInAtCloud: response.roleInAtCloud ?? undefined,
        avatar: response.avatar ?? undefined,
        gender: response.gender ?? undefined,
        phone: response.phone ?? undefined,
        dateOfBirth: response.dateOfBirth ?? undefined,
        location: response.location ?? undefined,
        bio: response.bio ?? undefined,
        joinedAt:
          response.createdAt ?? response.joinedAt ?? new Date().toISOString(),
        lastActive: response.lastLogin ?? undefined,
        isActive: true, // Default to true as the API doesn't provide this field
        emailVerified: response.emailVerified ?? undefined,
      };

      setProfile(convertedProfile);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load user profile";
      setError(errorMessage);
      showError(errorMessage);
      console.error("Error fetching user profile:", err);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await userService.updateProfile(updates);

        // Update local state with response
        if (response && profile) {
          const updatedProfile = { ...profile, ...updates };
          setProfile(updatedProfile);
        }

        success("Profile updated successfully");
        return true;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update profile";
        setError(errorMessage);
        showError(errorMessage);
        console.error("Error updating profile:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [profile, success, showError]
  );

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  // Auto-load profile on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refreshProfile,
    updateProfile,
  };
}

// Hook for getting all users (admin functionality)
export function useUsers(options?: { suppressErrors?: boolean }) {
  const { error: showError } = useToastReplacement();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalUsers: 0,
    hasNext: false,
    hasPrev: false,
  });

  const fetchUsers = useCallback(
    async (params: Record<string, unknown> = {}) => {
      setLoading(true);
      setError(null);

      try {
        const response = (await userService.getUsers(
          params
        )) as unknown as BackendUsersResponse;

        // Convert backend users format to frontend UserProfile format
        const convertedUsers: UserProfile[] = response.users.map(
          (user: BackendUser) => ({
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            role: user.role,
            systemAuthorizationLevel: user.role,
            isAtCloudLeader: user.isAtCloudLeader ?? undefined,
            roleInAtCloud: user.roleInAtCloud ?? undefined,
            avatar: user.avatar ?? undefined,
            gender: (user.gender ?? undefined) as UserProfile["gender"],
            phone: user.phone ?? undefined,
            dateOfBirth: user.dateOfBirth ?? undefined,
            location: user.location ?? undefined,
            bio: user.bio ?? undefined,
            joinedAt:
              user.createdAt ?? user.joinedAt ?? new Date().toISOString(),
            lastActive: user.lastActive ?? undefined,
            isActive: user.isActive !== false,
            emailVerified: user.emailVerified ?? undefined,
            // Add missing fields for analytics
            occupation: user.occupation ?? undefined,
            company: user.company ?? undefined,
            weeklyChurch: user.weeklyChurch ?? undefined,
            churchAddress: user.churchAddress ?? undefined,
          })
        );

        setUsers(convertedUsers);
        setPagination(response.pagination);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load users";
        setError(errorMessage);
        if (!options?.suppressErrors) {
          showError(errorMessage);
        }
        console.error("Error fetching users:", err);
      } finally {
        setLoading(false);
      }
    },
    [showError, options?.suppressErrors]
  );

  const searchUsers = useCallback(
    async (searchTerm: string) => {
      await fetchUsers({ search: searchTerm, page: 1 });
    },
    [fetchUsers]
  );

  const filterUsers = useCallback(
    async (filters: {
      role?: string;
      isActive?: boolean;
      emailVerified?: boolean;
    }) => {
      await fetchUsers({ ...filters, page: 1 });
    },
    [fetchUsers]
  );

  // Enhanced method for advanced filtering and sorting
  const fetchUsersWithFilters = useCallback(
    async (params: {
      search?: string;
      role?: string;
      gender?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      page?: number;
      limit?: number;
    }) => {
      // Clean up undefined values to avoid sending empty params
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(
          ([, value]) => value !== undefined && value !== ""
        )
      );

      await fetchUsers(cleanParams);
    },
    [fetchUsers]
  );

  const loadPage = useCallback(
    async (
      page: number,
      currentFilters?: {
        search?: string;
        role?: string;
        gender?: string;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
      }
    ) => {
      if (currentFilters) {
        await fetchUsersWithFilters({ ...currentFilters, page });
      } else {
        await fetchUsers({ page });
      }
    },
    [fetchUsers, fetchUsersWithFilters]
  );

  const refreshUsers = useCallback(async () => {
    await fetchUsers();
  }, [fetchUsers]);

  // Auto-load users on mount
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    pagination,
    searchUsers,
    filterUsers,
    fetchUsersWithFilters,
    loadPage,
    refreshUsers,
  };
}

// Hook for getting user statistics
export function useUserStats() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = (await userService.getUserStats()) as unknown as Record<
        string,
        unknown
      >;
      setStats(response);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load user statistics";
      setError(errorMessage);
      console.error("Error fetching user stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refreshStats: fetchStats,
  };
}

// Hook for getting specific user by ID
export function useUser(userId: string) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = (await userService.getUser(
        userId
      )) as unknown as BackendUserBase;

      // Convert backend user format to frontend UserProfile format
      const convertedUser: UserProfile = {
        id: response.id,
        username: response.username,
        email: response.email,
        firstName: response.firstName ?? "",
        lastName: response.lastName ?? "",
        role: response.role,
        systemAuthorizationLevel: response.role,
        roleInAtCloud: response.roleInAtCloud ?? undefined,
        avatar: response.avatar ?? undefined,
        gender: response.gender ?? undefined,
        phone: response.phone ?? undefined,
        dateOfBirth: response.dateOfBirth ?? undefined,
        location: response.location ?? undefined,
        bio: response.bio ?? undefined,
        joinedAt:
          response.createdAt ?? response.joinedAt ?? new Date().toISOString(),
        lastActive: response.lastLogin ?? undefined,
        isActive: true,
        emailVerified: response.emailVerified ?? undefined,
      };

      setUser(convertedUser);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load user";
      setError(errorMessage);
      console.error("Error fetching user:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    loading,
    error,
    refreshUser: fetchUser,
  };
}
