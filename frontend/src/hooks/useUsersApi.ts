import { useState, useEffect, useCallback } from "react";
import { userService } from "../services/api";
import toast from "react-hot-toast";

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  systemAuthorizationLevel: string;
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await userService.getProfile();

      // Convert backend user format to frontend UserProfile format
      const convertedProfile: UserProfile = {
        id: response.id,
        username: response.username,
        email: response.email,
        firstName: response.firstName || "",
        lastName: response.lastName || "",
        role: response.role,
        systemAuthorizationLevel: response.role, // Use role as system authorization level
        roleInAtCloud: response.roleInAtCloud,
        avatar: response.avatar,
        gender: (response as any).gender,
        phone: (response as any).phone,
        dateOfBirth: (response as any).dateOfBirth,
        location: (response as any).location,
        bio: (response as any).bio,
        joinedAt:
          (response as any).createdAt ||
          (response as any).joinedAt ||
          new Date().toISOString(),
        lastActive: response.lastLogin,
        isActive: true, // Default to true as the API doesn't provide this field
        emailVerified: (response as any).emailVerified,
      };

      setProfile(convertedProfile);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load user profile";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error fetching user profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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

        toast.success("Profile updated successfully");
        return true;
      } catch (err: any) {
        const errorMessage = err.message || "Failed to update profile";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error("Error updating profile:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [profile]
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
export function useUsers() {
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

  const fetchUsers = useCallback(async (params: any = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await userService.getUsers(params);

      // Convert backend users format to frontend UserProfile format
      const convertedUsers: UserProfile[] = response.users.map((user: any) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        role: user.role,
        systemAuthorizationLevel: user.role,
        roleInAtCloud: user.roleInAtCloud,
        avatar: user.avatar,
        gender: user.gender,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        location: user.location,
        bio: user.bio,
        joinedAt: user.createdAt || user.joinedAt || new Date().toISOString(),
        lastActive: user.lastActive,
        isActive: user.isActive !== false,
        emailVerified: user.emailVerified,
      }));

      setUsers(convertedUsers);
      setPagination(response.pagination);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load users";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const loadPage = useCallback(
    async (page: number) => {
      await fetchUsers({ page });
    },
    [fetchUsers]
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
    loadPage,
    refreshUsers,
  };
}

// Hook for getting user statistics
export function useUserStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await userService.getUserStats();
      setStats(response);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load user statistics";
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
      const response = await userService.getUser(userId);

      // Convert backend user format to frontend UserProfile format
      const convertedUser: UserProfile = {
        id: response.id,
        username: response.username,
        email: response.email,
        firstName: response.firstName || "",
        lastName: response.lastName || "",
        role: response.role,
        systemAuthorizationLevel: response.role,
        roleInAtCloud: response.roleInAtCloud,
        avatar: response.avatar,
        gender: (response as any).gender,
        phone: (response as any).phone,
        dateOfBirth: (response as any).dateOfBirth,
        location: (response as any).location,
        bio: (response as any).bio,
        joinedAt:
          (response as any).createdAt ||
          (response as any).joinedAt ||
          new Date().toISOString(),
        lastActive: response.lastLogin,
        isActive: true,
        emailVerified: (response as any).emailVerified,
      };

      setUser(convertedUser);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load user";
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
