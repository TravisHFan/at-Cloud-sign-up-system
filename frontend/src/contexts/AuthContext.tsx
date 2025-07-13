import React, { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type {
  AuthUser,
  LoginFormData,
  SystemAuthorizationLevel,
} from "../types";
import { authService } from "../services/api";
import {
  sendWelcomeMessage,
  hasWelcomeMessageBeenSent,
} from "../utils/welcomeMessageService";

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

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on app start
  React.useEffect(() => {
    const checkExistingAuth = async () => {
      const token = localStorage.getItem("authToken");
      if (token) {
        try {
          // Validate token with the server by getting user profile
          const userProfile = await authService.getProfile();

          // Convert backend user format to frontend AuthUser format
          const authUser: AuthUser = {
            id: userProfile.id,
            username: userProfile.username,
            firstName: userProfile.firstName || "",
            lastName: userProfile.lastName || "",
            email: userProfile.email,
            role: userProfile.role as SystemAuthorizationLevel,
            isAtCloudLeader: userProfile.isAtCloudLeader ? "Yes" : "No",
            roleInAtCloud: userProfile.roleInAtCloud,
            gender: userProfile.avatar?.includes("female") ? "female" : "male", // Infer from avatar or add gender field
            avatar: userProfile.avatar || "/default-avatar-male.jpg",
          };

          setCurrentUser(authUser);
        } catch (error) {
          // Token is invalid, remove it
          localStorage.removeItem("authToken");
          console.error("Token validation failed:", error);
        }
      }
      setIsLoading(false);
    };

    checkExistingAuth();
  }, []);

  const login = useCallback(async (credentials: LoginFormData) => {
    setIsLoading(true);

    try {
      // Use real API login
      const authResponse = await authService.login(
        credentials.username, // This could be email or username
        credentials.password,
        credentials.rememberMe
      );

      // Convert backend user format to frontend AuthUser format
      const authUser: AuthUser = {
        id: authResponse.user.id,
        username: authResponse.user.username,
        firstName: authResponse.user.firstName || "",
        lastName: authResponse.user.lastName || "",
        email: authResponse.user.email,
        role: authResponse.user.role as SystemAuthorizationLevel,
        isAtCloudLeader: authResponse.user.isAtCloudLeader ? "Yes" : "No",
        roleInAtCloud: authResponse.user.roleInAtCloud,
        gender: authResponse.user.avatar?.includes("female")
          ? "female"
          : "male",
        avatar: authResponse.user.avatar || "/default-avatar-male.jpg",
      };

      setCurrentUser(authUser);

      // Log login activity
      console.log(
        `User ${authUser.username} logged in at ${new Date().toISOString()}`
      );

      // Check if this is a first login and send welcome message
      const isFirstLogin = !hasWelcomeMessageBeenSent(authUser.id);
      if (isFirstLogin) {
        // Use setTimeout to ensure NotificationContext is ready
        setTimeout(() => {
          sendWelcomeMessage(authUser, true);
        }, 100);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // Log logout activity
    if (currentUser) {
      console.log(
        `User ${currentUser.username} logged out at ${new Date().toISOString()}`
      );
    }

    try {
      // Call backend logout endpoint
      await authService.logout();
    } catch (error) {
      console.error("Logout error:", error);
      // Continue with local logout even if backend call fails
    }

    setCurrentUser(null);
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("authToken");
  }, [currentUser]);

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
