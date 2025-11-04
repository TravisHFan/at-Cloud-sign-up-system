import {
  CalendarDaysIcon,
  UserPlusIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/solid";

export interface AnalyticsOverviewCardsProps {
  totalEvents: number;
  totalUsers: number;
  activeParticipants: number;
  averageSignupRate: number;
}

export function AnalyticsOverviewCards({
  totalEvents,
  totalUsers,
  activeParticipants,
  averageSignupRate,
}: AnalyticsOverviewCardsProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      data-testid="analytics-overview-cards"
    >
      <div
        className="bg-blue-50 rounded-lg p-6 flex flex-col gap-2"
        data-testid="analytics-card-total-events"
      >
        <div className="flex items-center gap-2">
          <CalendarDaysIcon
            className="w-5 h-5 text-blue-500"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-blue-600">Total Events</p>
        </div>
        <p
          className="text-2xl font-semibold text-blue-900"
          aria-label="total-events-value"
        >
          {totalEvents}
        </p>
      </div>
      <div
        className="bg-green-50 rounded-lg p-6 flex flex-col gap-2"
        data-testid="analytics-card-total-users"
      >
        <div className="flex items-center gap-2">
          <UserPlusIcon className="w-5 h-5 text-green-500" aria-hidden="true" />
          <p className="text-sm font-medium text-green-600">Total Users</p>
        </div>
        <p
          className="text-2xl font-semibold text-green-900"
          aria-label="total-users-value"
        >
          {totalUsers}
        </p>
      </div>
      <div
        className="bg-purple-50 rounded-lg p-6 flex flex-col gap-2"
        data-testid="analytics-card-active-participants"
      >
        <div className="flex items-center gap-2">
          <ChartBarIcon
            className="w-5 h-5 text-purple-500"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-purple-600">
            Active Participants
          </p>
        </div>
        <p
          className="text-2xl font-semibold text-purple-900"
          aria-label="active-participants-value"
        >
          {activeParticipants}
        </p>
      </div>
      <div
        className="bg-orange-50 rounded-lg p-6 flex flex-col gap-2"
        data-testid="analytics-card-avg-signup-rate"
      >
        <div className="flex items-center gap-2">
          <ArrowTrendingUpIcon
            className="w-5 h-5 text-orange-500"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-orange-600">
            Avg. Signup Rate
          </p>
        </div>
        <p
          className="text-2xl font-semibold text-orange-900"
          aria-label="avg-signup-rate-value"
        >
          {averageSignupRate.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
