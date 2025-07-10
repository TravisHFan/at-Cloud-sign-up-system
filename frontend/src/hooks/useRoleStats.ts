import { useMemo } from "react";
import type { User, RoleStats } from "../types/management";

export const useRoleStats = (users: User[]): RoleStats => {
  return useMemo(() => {
    const stats = users.reduce(
      (acc, user) => {
        acc.total++;

        // Count system roles
        if (user.role === "Super Admin") {
          acc.superAdmin++;
        } else if (user.role === "Administrator") {
          acc.administrators++;
        } else if (user.role === "Leader") {
          acc.leaders++;
        } else if (user.role === "Participant") {
          acc.participants++; // Changed from acc.users++
        }

        // Count @Cloud leaders
        if (user.isAtCloudLeader === "Yes") {
          acc.atCloudLeaders++;
        }

        return acc;
      },
      {
        total: 0,
        superAdmin: 0,
        administrators: 0,
        leaders: 0,
        participants: 0, // Changed from users: 0
        atCloudLeaders: 0,
      }
    );

    return stats;
  }, [users]);
};
