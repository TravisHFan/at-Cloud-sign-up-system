import {
  UserGroupIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import type { RoleStats } from "../../types/management";
import { ROLE_DISPLAY } from "../../config/managementConstants";

interface ManagementStatisticsCardsProps {
  stats: RoleStats;
}

const STATISTICS_CONFIG = [
  {
    key: "total",
    label: "Total Users",
    icon: UserGroupIcon,
    colorClass: "blue",
    getValue: (stats: RoleStats) => stats.total + 1, // +1 for current user
  },
  {
    key: "administrators",
    label: "Administrators",
    icon: ShieldCheckIcon,
    colorClass: "red",
    getValue: (stats: RoleStats) => stats.administrators,
  },
  {
    key: "leaders",
    label: "Leaders",
    icon: UserPlusIcon,
    colorClass: "yellow",
    getValue: (stats: RoleStats) => stats.leaders,
  },
  {
    key: "participants", // Changed from "users"
    label: "Participants", // Changed from "Users"
    icon: UserIcon,
    colorClass: "green",
    getValue: (stats: RoleStats) => stats.participants, // Changed from stats.users
  },
  {
    key: "atCloudLeaders",
    label: "@Cloud Leaders",
    icon: UserPlusIcon,
    colorClass: "purple",
    getValue: (stats: RoleStats) => stats.atCloudLeaders,
  },
] as const;

const COLOR_CLASSES = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    value: "text-blue-900",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-600",
    value: "text-red-900",
  },
  yellow: {
    bg: "bg-yellow-50",
    text: "text-yellow-600",
    value: "text-yellow-900",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-600",
    value: "text-green-900",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    value: "text-purple-900",
  },
} as const;

export default function ManagementStatisticsCards({
  stats,
}: ManagementStatisticsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {STATISTICS_CONFIG.map((config) => {
        const Icon = config.icon;
        const colors = COLOR_CLASSES[config.colorClass];
        const value = config.getValue(stats);

        return (
          <div key={config.key} className={`${colors.bg} rounded-lg p-4`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Icon className={`h-8 w-8 ${colors.text}`} />
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${colors.text}`}>
                  {config.label}
                </p>
                <p className={`text-2xl font-bold ${colors.value}`}>{value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
