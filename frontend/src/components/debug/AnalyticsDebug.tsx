import { useAnalyticsData } from "../../hooks/useBackendIntegration";
import { useUserData } from "../../hooks/useUserData";
import { useRoleStats } from "../../hooks/useRoleStats";

export function AnalyticsDebug() {
  const {
    analytics,
    userAnalytics,
    eventAnalytics,
    engagementAnalytics,
    loading,
    error,
  } = useAnalyticsData();

  const { users, loading: usersLoading, error: usersError } = useUserData();
  const roleStats = useRoleStats(users);

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Analytics Debug Info</h2>

      <div className="space-y-4">
        <div>
          <h3 className="font-medium">Backend Analytics</h3>
          <p>Loading: {loading ? "Yes" : "No"}</p>
          <p>Error: {error || "None"}</p>
          <p>General Analytics: {analytics ? "Loaded" : "Not loaded"}</p>
          <p>User Analytics: {userAnalytics ? "Loaded" : "Not loaded"}</p>
          <p>Event Analytics: {eventAnalytics ? "Loaded" : "Not loaded"}</p>
          <p>
            Engagement Analytics:{" "}
            {engagementAnalytics ? "Loaded" : "Not loaded"}
          </p>
          {eventAnalytics && (
            <div className="ml-4">
              <p>
                Upcoming Events: {eventAnalytics.upcomingEvents?.length || 0}
              </p>
              <p>
                Completed Events: {eventAnalytics.completedEvents?.length || 0}
              </p>
            </div>
          )}
        </div>

        <div>
          <h3 className="font-medium">User Data</h3>
          <p>Loading: {usersLoading ? "Yes" : "No"}</p>
          <p>Error: {usersError || "None"}</p>
          <p>Users Count: {users.length}</p>
          <p>Role Stats Total: {roleStats.total}</p>
        </div>

        {error && (
          <div className="text-red-600 text-sm">
            <h4 className="font-medium">Error Details:</h4>
            <pre>{error}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
