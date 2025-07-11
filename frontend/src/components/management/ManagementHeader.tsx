import type { SystemRole, RoleStats } from "../../types/management";
import StatisticsCards from "./StatisticsCards";
import { PageHeader } from "../ui";

interface ManagementHeaderProps {
  currentUserRole: SystemRole;
  roleStats: RoleStats;
}

export default function ManagementHeader({
  currentUserRole,
  roleStats,
}: ManagementHeaderProps) {
  // Dynamic subtitle based on user role
  const getSubtitleForRole = (role: SystemRole): string => {
    switch (role) {
      case "Super Admin":
        return "Manage user roles and permissions for @Cloud Marketplace Ministry. As a Super Admin, you have full access to view all users and manage their access levels across the entire system.";
      case "Administrator":
        return "Manage user roles and permissions for @Cloud Marketplace Ministry. As an Administrator, you can view all users and manage their access levels within your scope of authority.";
      case "Leader":
        return "View user information for @Cloud Marketplace Ministry. As a Leader, you can view user details but have limited management capabilities.";
      default:
        return "View user information for @Cloud Marketplace Ministry.";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle={getSubtitleForRole(currentUserRole)}
      />

      {/* Statistics Cards */}
      <StatisticsCards stats={roleStats} />
    </div>
  );
}
