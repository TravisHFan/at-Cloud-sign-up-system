// Analytics Dashboard with robust loading skeletons to avoid misleading zero values
import { useMemo, useState, useEffect } from "react";
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
import { FinancialHealthCards } from "../components/analytics/FinancialHealthCards";
import { FinancialTrendsChart } from "../components/analytics/FinancialTrendsChart";
import { EventStatisticsCards } from "../components/analytics/EventStatisticsCards";
import { RoleFormatDistribution } from "../components/analytics/RoleFormatDistribution";
import { UserEngagementSection } from "../components/analytics/UserEngagementSection";
import { ParticipantDemographics } from "../components/analytics/ParticipantDemographics";
import { ProgramAnalyticsSection } from "../components/analytics/ProgramAnalyticsSection";
import { DonationAnalyticsSection } from "../components/analytics/DonationAnalyticsSection";
import {
  analyticsService,
  type ProgramAnalytics,
  type DonationAnalytics,
  type FinancialSummary,
} from "../services/api/analytics.api";

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
  // Financial data visibility: Only Super Admin and Administrator
  const hasFinancialAccess =
    !!currentUser &&
    ["Super Admin", "Administrator"].includes(currentUser.role);
  const {
    eventAnalytics: backendEventAnalytics,
    loading: backendLoading,
    exportData,
  } = useAnalyticsData({
    enabled: hasAnalyticsAccess,
    suppressAuthErrors: !hasAnalyticsAccess,
  });

  // Financial analytics state
  const [financialSummary, setFinancialSummary] =
    useState<FinancialSummary | null>(null);
  const [programAnalytics, setProgramAnalytics] =
    useState<ProgramAnalytics | null>(null);
  const [donationAnalytics, setDonationAnalytics] =
    useState<DonationAnalytics | null>(null);
  const [financialLoading, setFinancialLoading] = useState(true);
  const [financialError, setFinancialError] = useState<string | null>(null);

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showExportMenu) setShowExportMenu(false);
    };

    if (showExportMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showExportMenu]);

  // Fetch financial analytics data
  useEffect(() => {
    if (!hasFinancialAccess) {
      setFinancialLoading(false);
      return;
    }

    const fetchFinancialData = async () => {
      try {
        setFinancialLoading(true);
        setFinancialError(null);

        const [summary, programs, donations] = await Promise.all([
          analyticsService.getFinancialSummary(),
          analyticsService.getProgramAnalytics(),
          analyticsService.getDonationAnalytics(),
        ]);

        setFinancialSummary(summary);
        setProgramAnalytics(programs);
        setDonationAnalytics(donations);
      } catch (err) {
        console.error("Error fetching financial analytics:", err);
        setFinancialError("Failed to load financial analytics");
      } finally {
        setFinancialLoading(false);
      }
    };

    fetchFinancialData();
  }, [hasFinancialAccess]);

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
  const handleExport = (format: "xlsx" | "csv" | "json" = "xlsx") => {
    if (canExport) {
      exportData(format);
      setShowExportMenu(false);
    }
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
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportMenu(!showExportMenu);
                }}
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
                <svg
                  className="w-4 h-4 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={() => handleExport("xlsx")}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <div className="font-medium">Export All (Excel)</div>
                      <div className="text-xs text-gray-500">
                        Users, Events, Programs, Donations
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport("csv")}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <div className="font-medium">Export Summary (CSV)</div>
                      <div className="text-xs text-gray-500">Counts only</div>
                    </button>
                    <button
                      onClick={() => handleExport("json")}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <div className="font-medium">Export All (JSON)</div>
                      <div className="text-xs text-gray-500">Complete data</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
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

        {/* Financial Health Overview - Super Admin & Administrator only */}
        {hasFinancialAccess && (
          <>
            {financialLoading ? (
              <AnalyticsOverviewLoadingState />
            ) : financialError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
                <p className="text-sm text-red-600">{financialError}</p>
              </div>
            ) : (
              financialSummary && (
                <FinancialHealthCards
                  totalRevenue={financialSummary.totalRevenue}
                  programRevenue={financialSummary.programs.revenue}
                  programPurchases={financialSummary.programs.purchases}
                  donationRevenue={financialSummary.donations.revenue}
                  donationGifts={financialSummary.donations.gifts}
                  last30DaysRevenue={financialSummary.last30Days.revenue}
                  last30DaysPercentage={financialSummary.last30Days.percentage}
                  growthRate={financialSummary.growthRate}
                />
              )
            )}

            {/* Financial Trends Chart */}
            <FinancialTrendsChart />
          </>
        )}

        {/* Program Analytics */}
        {financialLoading ? (
          <AnalyticsCardSectionLoadingState cardCount={2} itemCount={5} />
        ) : (
          programAnalytics && (
            <ProgramAnalyticsSection analytics={programAnalytics} />
          )
        )}

        {/* Donation Analytics */}
        {financialLoading ? (
          <AnalyticsCardSectionLoadingState cardCount={2} itemCount={5} />
        ) : (
          donationAnalytics && (
            <DonationAnalyticsSection analytics={donationAnalytics} />
          )
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
          <ParticipantDemographics
            churchAnalytics={churchAnalytics}
            occupationAnalytics={occupationAnalytics}
          />
        )}
      </div>
    </div>
  );
}
