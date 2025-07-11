import React, { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { AuthUser, LoginFormData } from "../types";

interface AuthContextType {
  // State
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (
    credentials: LoginFormData
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;

  // Permissions
  canCreateEvents: boolean;
  canManageUsers: boolean;
  hasRole: (roles: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Mock user for development - replace with actual auth integration
const MOCK_USER: AuthUser = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  username: "john_doe",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  role: "Super Admin",
  isAtCloudLeader: "Yes",
  roleInAtCloud: "System Administrator",
  gender: "male",
  avatar: null,
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(MOCK_USER);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (credentials: LoginFormData) => {
    setIsLoading(true);

    try {
      // Mock login - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate login validation
      if (credentials.username && credentials.password) {
        setCurrentUser(MOCK_USER);

        // Store auth token in localStorage for persistence
        localStorage.setItem("authToken", "mock-jwt-token");

        return { success: true };
      } else {
        return { success: false, error: "Invalid credentials" };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("authToken");
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  // Permission helpers
  const canCreateEvents = useCallback(() => {
    return (
      !!currentUser &&
      ["Super Admin", "Administrator", "Leader"].includes(currentUser.role)
    );
  }, [currentUser]);

  const canManageUsers = useCallback(() => {
    return (
      !!currentUser &&
      ["Super Admin", "Administrator"].includes(currentUser.role)
    );
  }, [currentUser]);

  const hasRole = useCallback(
    (roles: string | string[]) => {
      if (!currentUser) return false;
      const roleArray = Array.isArray(roles) ? roles : [roles];
      return roleArray.includes(currentUser.role);
    },
    [currentUser]
  );

  const value: AuthContextType = {
    // State
    currentUser,
    isAuthenticated: !!currentUser,
    isLoading,

    // Actions
    login,
    logout,
    updateUser,

    // Permissions
    canCreateEvents: canCreateEvents(),
    canManageUsers: canManageUsers(),
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
      // In a real app, this would redirect to login
      return <div>Please log in to access this page.</div>;
    }

    return <Component {...props} />;
  };
}

// Hook for role-based access
export function useRequireRole(requiredRoles: string | string[]) {
  const { hasRole, currentUser } = useAuth();

  const hasAccess = hasRole(requiredRoles);

  return {
    hasAccess,
    currentUser,
    requiredRoles: Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles],
  };
}
