import { useState } from "react";

// This is a mock auth hook - replace with real authentication later
export interface AuthUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "Super Admin" | "Administrator" | "Leader" | "Participant";
  isAtCloudLeader: "Yes" | "No";
  roleInAtCloud?: string;
}

export function useAuth() {
  // Mock current user - this will come from actual auth provider later
  const [currentUser] = useState<AuthUser>({
    id: 1,
    username: "john_doe",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    role: "Super Admin", // Change this to test different role behaviors
    isAtCloudLeader: "Yes",
    roleInAtCloud: "System Administrator",
  });

  // Helper functions
  const canCreateEvents = () => {
    return ["Super Admin", "Administrator", "Leader"].includes(
      currentUser.role
    );
  };

  const isLoggedIn = () => {
    return !!currentUser;
  };

  return {
    currentUser,
    isLoggedIn: isLoggedIn(),
    canCreateEvents: canCreateEvents(),
  };
}
