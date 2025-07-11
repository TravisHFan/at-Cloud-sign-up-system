import type {
  SystemAuthorizationLevel,
  RoleStats,
} from "../../types/management";
import StatisticsCards from "./StatisticsCards";
import { PageHeader } from "../ui";

interface ManagementHeaderProps {
  currentUserRole: SystemAuthorizationLevel;
  roleStats: RoleStats;
}

export default function ManagementHeader({
  currentUserRole,
  roleStats,
}: ManagementHeaderProps) {
  // Dynamic title and subtitle based on user role
  const getTitleForRole = (role: SystemAuthorizationLevel): string => {
    switch (role) {
      case "Leader":
        return "Community";
      default:
        return "User Management";
    }
  };

  const getSubtitleForRole = (role: SystemAuthorizationLevel): string => {
    switch (role) {
      case "Super Admin":
        return "Manage user roles and permissions for @Cloud Marketplace Ministry. As a Super Admin, you have full access to view all users and manage their access levels across the entire system.";
      case "Administrator":
        return "Manage user roles and permissions for @Cloud Marketplace Ministry. As an Administrator, you can view all users and manage their access levels within your scope of authority.";
      case "Leader":
        return "View community members and their information for @Cloud Marketplace Ministry. As a Leader, you can browse member profiles and see community statistics.";
      default:
        return "View user information for @Cloud Marketplace Ministry.";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={getTitleForRole(currentUserRole)}
        subtitle={getSubtitleForRole(currentUserRole)}
      />

      {/* Statistics Cards */}
      <StatisticsCards stats={roleStats} />
    </div>
  );
}
