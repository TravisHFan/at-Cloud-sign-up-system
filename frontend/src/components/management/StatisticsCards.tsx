import {
  UserGroupIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import type { RoleStats } from "../../types/management";
import { StatsGrid, StatsCard } from "../ui";

interface StatisticsCardsProps {
  stats: RoleStats;
}

export default function StatisticsCards({ stats }: StatisticsCardsProps) {
  const statisticsData = [
    {
      title: "Total Users",
      value: stats.total,
      icon: <UserGroupIcon className="h-8 w-8" />,
      color: "blue" as const,
    },
    {
      title: "Administrators",
      value: stats.administrators,
      icon: <ShieldCheckIcon className="h-8 w-8" />,
      color: "red" as const,
    },
    {
      title: "Leaders",
      value: stats.leaders,
      icon: <UserPlusIcon className="h-8 w-8" />,
      color: "yellow" as const,
    },
    {
      title: "Participants",
      value: stats.participants,
      icon: <UserIcon className="h-8 w-8" />,
      color: "green" as const,
    },
    {
      title: "@Cloud Leaders",
      value: stats.atCloudLeaders,
      icon: <UserPlusIcon className="h-8 w-8" />,
      color: "purple" as const,
    },
  ];

  return (
    <StatsGrid columns={5}>
      {statisticsData.map((stat, index) => (
        <StatsCard
          key={index}
          title={stat.title}
          value={stat.value}
          icon={stat.icon}
          color={stat.color}
        />
      ))}
    </StatsGrid>
  );
}
