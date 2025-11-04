// Analytics Dashboard with robust loading skeletons to avoid misleading zero values
import { useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserData } from "../hooks/useUserData";
import { useRoleStats } from "../hooks/useRoleStats";
import { useAnalyticsData } from "../hooks/useBackendIntegration";
import {
  AnalyticsOverviewLoadingState,
  AnalyticsCardSectionLoadingState,
} from "../components/ui/LoadingStates";
import type { EventData } from "../types/event";
import {
  calculateEventAnalytics,
  calculateUserEngagement,
  calculateGuestAggregates,
  calculateChurchAnalytics,
  calculateOccupationAnalytics,
} from "../utils/analyticsCalculations";
import { AnalyticsOverviewCards } from "../components/analytics/AnalyticsOverviewCards";
import { EventStatisticsCards } from "../components/analytics/EventStatisticsCards";
import { RoleFormatDistribution } from "../components/analytics/RoleFormatDistribution";
import { UserEngagementSection } from "../components/analytics/UserEngagementSection";

export default function Analytics() {
  const { currentUser } = useAuth();
  // Determine access first so we can suppress user fetch errors for restricted roles
  const hasAnalyticsAccessPre =
    !!currentUser &&
    ["Super Admin", "Administrator", "Leader"].includes(currentUser.role);
  const { users } = useUserData({
    fetchAll: true,
    limit: 100,
    suppressErrors: !hasAnalyticsAccessPre,
  });
  const roleStats = useRoleStats(users);

  const hasAnalyticsAccess = hasAnalyticsAccessPre;
  const {
    eventAnalytics: backendEventAnalytics,
    loading: backendLoading,
    exportData,
  } = useAnalyticsData({
    enabled: hasAnalyticsAccess,
    suppressAuthErrors: !hasAnalyticsAccess,
  });

  const isEventData = (item: unknown): item is EventData => {
    if (!item || typeof item !== "object") return false;
    const e = item as Partial<EventData>;
    return (
      typeof e.id === "string" &&
      typeof e.title === "string" &&
      Array.isArray(e.roles)
    );
  };

  const upcomingEvents = useMemo<EventData[]>(() => {
    const src = backendEventAnalytics?.upcomingEvents;
    return Array.isArray(src) ? (src.filter(isEventData) as EventData[]) : [];
  }, [backendEventAnalytics]);

  const passedEvents = useMemo<EventData[]>(() => {
    const src = backendEventAnalytics?.completedEvents;
    return Array.isArray(src) ? (src.filter(isEventData) as EventData[]) : [];
  }, [backendEventAnalytics]);

  const eventAnalytics = useMemo(
    () => calculateEventAnalytics(upcomingEvents, passedEvents),
    [upcomingEvents, passedEvents]
  );
  const engagementMetrics = useMemo(
    () => calculateUserEngagement(upcomingEvents, passedEvents),
    [upcomingEvents, passedEvents]
  );
  const avgRolesPerParticipant = useMemo(
    () =>
      engagementMetrics.uniqueParticipants > 0
        ? engagementMetrics.userSignups / engagementMetrics.uniqueParticipants
        : 0,
    [engagementMetrics.userSignups, engagementMetrics.uniqueParticipants]
  );
  const guestAggregates = useMemo(
    () => calculateGuestAggregates(upcomingEvents, passedEvents),
    [upcomingEvents, passedEvents]
  );
  const churchAnalytics = useMemo(
    () => calculateChurchAnalytics(users),
    [users]
  );
  const occupationAnalytics = useMemo(
    () => calculateOccupationAnalytics(users),
    [users]
  );

  if (!hasAnalyticsAccess) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Restricted
            </h2>
            <p className="text-gray-600 mb-4">
              You don't have permission to access the Analytics dashboard.
            </p>
            <p className="text-sm text-gray-500">
              Analytics access is restricted to Super Admins, Administrators,
              and Leaders only.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              To request access as an @Cloud co‑worker, please contact your
              @Cloud Leaders.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const canExport = hasAnalyticsAccess;
  const handleExport = () => {
    if (canExport) exportData("xlsx");
  };

  // Only gate skeletons on backend analytics loading. Even if users array is empty (e.g. in tests
  // where it's intentionally mocked), we still want to render analytics sections once event data
  // is available so headings like "Most Active Participants" are present.
  const isLoading = backendLoading;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Analytics Dashboard
          </h1>
          {canExport && (
            <button
              onClick={handleExport}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export Data
            </button>
          )}
        </div>

        {/* Overview Cards */}
        {isLoading ? (
          <AnalyticsOverviewLoadingState />
        ) : (
          <AnalyticsOverviewCards
            totalEvents={eventAnalytics.totalEvents}
            totalUsers={roleStats.total}
            activeParticipants={engagementMetrics.uniqueParticipants}
            averageSignupRate={eventAnalytics.averageSignupRate}
          />
        )}

        {/* Event Statistics */}
        {isLoading ? (
          <AnalyticsCardSectionLoadingState cardCount={2} itemCount={5} />
        ) : (
          <EventStatisticsCards
            upcomingEvents={eventAnalytics.upcomingEvents}
            upcomingStats={eventAnalytics.upcomingStats}
            passedEvents={eventAnalytics.passedEvents}
            passedStats={eventAnalytics.passedStats}
          />
        )}

        {/* Role Distribution & Format Distribution */}
        {isLoading ? (
          <AnalyticsCardSectionLoadingState cardCount={2} itemCount={6} />
        ) : (
          <RoleFormatDistribution
            roleStats={roleStats}
            formatStats={eventAnalytics.formatStats}
          />
        )}

        {/* Most Active & Engagement Summary */}
        {isLoading ? (
          <AnalyticsCardSectionLoadingState cardCount={2} itemCount={6} />
        ) : (
          <UserEngagementSection
            mostActiveUsers={engagementMetrics.mostActiveUsers}
            uniqueParticipants={engagementMetrics.uniqueParticipants}
            userSignups={engagementMetrics.userSignups}
            guestSignups={guestAggregates.guestSignups}
            uniqueGuests={guestAggregates.uniqueGuests}
            totalEvents={eventAnalytics.totalEvents}
            avgRolesPerParticipant={avgRolesPerParticipant}
          />
        )}

        {/* Church & Occupation */}
        {isLoading ? (
          <AnalyticsCardSectionLoadingState cardCount={2} itemCount={6} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-2">
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Church Statistics
              </h3>
              <div className="space-y-4">
                <SummaryRow
                  label="Total Churches"
                  value={churchAnalytics.totalChurches}
                />
                <SummaryRow
                  label="Church Locations"
                  value={churchAnalytics.totalChurchLocations}
                />
                <SummaryRow
                  label="Users with Church Info"
                  value={churchAnalytics.usersWithChurchInfo}
                  accent="text-green-600"
                />
                <SummaryRow
                  label="Participation Rate"
                  value={`${churchAnalytics.churchParticipationRate.toFixed(
                    1
                  )}%`}
                />
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{
                      width: `${churchAnalytics.churchParticipationRate}%`,
                    }}
                  />
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Most Common Churches:
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(churchAnalytics.weeklyChurchStats)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([church, count]) => (
                        <div
                          key={church}
                          className="flex justify-between text-xs"
                        >
                          <span className="text-gray-600 truncate">
                            {church}
                          </span>
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Occupation Statistics
              </h3>
              <div className="space-y-4">
                <SummaryRow
                  label="Total Occupations"
                  value={occupationAnalytics.totalOccupationTypes}
                />
                <SummaryRow
                  label="Users with Occupation"
                  value={occupationAnalytics.usersWithOccupation}
                  accent="text-green-600"
                />
                <SummaryRow
                  label="Completion Rate"
                  value={`${occupationAnalytics.occupationCompletionRate.toFixed(
                    1
                  )}%`}
                />
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${occupationAnalytics.occupationCompletionRate}%`,
                    }}
                  />
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Most Common Occupations:
                  </h4>
                  <div className="space-y-2">
                    {occupationAnalytics.topOccupations.map((o) => (
                      <div
                        key={o.occupation}
                        className="flex justify-between text-xs"
                      >
                        <span className="text-gray-600 truncate">
                          {o.occupation}
                        </span>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                          {o.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-600">{label}:</span>
      <span className={`font-medium ${accent || ""}`}>{value}</span>
    </div>
  );
}
