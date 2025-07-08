import type { SystemRole, RoleStats } from "../../types/management";
import StatisticsCards from "./StatisticsCards";

interface ManagementHeaderProps {
  currentUserRole: SystemRole;
  roleStats: RoleStats;
}

export default function ManagementHeader({
  currentUserRole,
  roleStats,
}: ManagementHeaderProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">User Management</h1>
      <p className="text-gray-600 mb-6">
        Manage user roles and permissions for @Cloud Marketplace Ministry. As a{" "}
        {currentUserRole}, you can view all users and manage their access
        levels.
      </p>

      {/* Statistics Cards */}
      <StatisticsCards stats={roleStats} />
    </div>
  );
}
