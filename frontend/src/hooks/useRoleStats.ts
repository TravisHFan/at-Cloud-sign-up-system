import { useMemo } from "react";
import type { User, RoleStats } from "../types/management";

export const useRoleStats = (users: User[]): RoleStats => {
  const stats = useMemo((): RoleStats => {
    return {
      total: users.length,
      superAdmin: 1, // There's only one Super Admin
      administrators: users.filter((user) => user.role === "Administrator")
        .length,
      leaders: users.filter((user) => user.role === "Leader").length,
      users: users.filter((user) => user.role === "User").length,
      atCloudLeaders: users.filter(
        (user) => user.atCloudRole === "I'm an @Cloud Leader"
      ).length,
    };
  }, [users]);

  return stats;
};
