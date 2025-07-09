import {
  UserGroupIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import type { RoleStats } from "../../types/management";

interface StatisticsCardsProps {
  stats: RoleStats;
}

export default function StatisticsCards({ stats }: StatisticsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <UserGroupIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-blue-600">Total Users</p>
            <p className="text-2xl font-bold text-blue-900">
              {stats.total + 1}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-red-50 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <ShieldCheckIcon className="h-8 w-8 text-red-600" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-red-600">Administrators</p>
            <p className="text-2xl font-bold text-red-900">
              {stats.administrators}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <UserPlusIcon className="h-8 w-8 text-yellow-600" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-yellow-600">Leaders</p>
            <p className="text-2xl font-bold text-yellow-900">
              {stats.leaders}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <UserIcon className="h-8 w-8 text-green-600" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-green-600">Participants</p>
            <p className="text-2xl font-bold text-green-900">
              {stats.participants}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-purple-50 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <UserPlusIcon className="h-8 w-8 text-purple-600" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-purple-600">
              @Cloud Leaders
            </p>
            <p className="text-2xl font-bold text-purple-900">
              {stats.atCloudLeaders}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
