// User authorization level types for the system
export type SystemAuthorizationLevel =
  | "Super Admin"
  | "Administrator"
  | "Leader"
  | "Participant"; // Changed from "User"

// @Cloud specific role types
export type AtCloudLeaderStatus = "Yes" | "No";

// User interface
export interface User {
  id: string; // UUID from backend
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: SystemAuthorizationLevel;
  isAtCloudLeader: AtCloudLeaderStatus;
  roleInAtCloud?: string; // Only present if isAtCloudLeader is "Yes"
  joinDate: string;
  gender: "male" | "female";
  avatar?: string | null; // Custom avatar URL or null for default
}

// Action interface for dropdown actions
export interface UserAction {
  label: string;
  onClick: () => void;
  className: string;
  disabled?: boolean;
}

// Role statistics interface
export interface RoleStats {
  total: number;
  superAdmin: number;
  administrators: number;
  leaders: number;
  participants: number; // Changed from 'users' to 'participants'
  atCloudLeaders: number;
}

// Props for components
export interface ManagementProps {
  currentUserRole: SystemAuthorizationLevel;
}

export interface UserTableProps {
  users: User[];
  currentUserRole: SystemAuthorizationLevel;
  openDropdown: number | null;
  onToggleDropdown: (userId: number) => void;
  onPromoteUser: (userId: number, newRole: SystemAuthorizationLevel) => void;
  onDemoteUser: (userId: number, newRole: SystemAuthorizationLevel) => void;
  onDeleteUser: (userId: number) => void;
}

export interface StatisticsCardsProps {
  stats: RoleStats;
}
