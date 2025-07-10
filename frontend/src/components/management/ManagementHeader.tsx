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
  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle={`Manage user roles and permissions for @Cloud Marketplace Ministry. As a ${currentUserRole}, you can view all users and manage their access levels.`}
      />

      {/* Statistics Cards */}
      <StatisticsCards stats={roleStats} />
    </div>
  );
}
