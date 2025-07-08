// User role types for the system
export type SystemRole = "Super Admin" | "Administrator" | "Leader" | "User";

// @Cloud specific role types
export type AtCloudRole = "I'm an @Cloud Leader" | "Regular Participant";

// User interface
export interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: SystemRole;
  atCloudRole: AtCloudRole;
  joinDate: string;
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
  users: number;
  atCloudLeaders: number;
}

// Props for components we'll create later
export interface ManagementProps {
  currentUserRole: SystemRole;
}

export interface UserTableProps {
  users: User[];
  currentUserRole: SystemRole;
  openDropdown: number | null;
  onToggleDropdown: (userId: number) => void;
  onPromoteUser: (userId: number, newRole: SystemRole) => void;
  onDemoteUser: (userId: number, newRole: SystemRole) => void;
  onDeleteUser: (userId: number) => void;
}

export interface StatisticsCardsProps {
  stats: RoleStats;
}