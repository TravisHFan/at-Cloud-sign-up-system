import { useMemo } from "react";
import { useUserData } from "../hooks/useUserData";
import { useRoleStats } from "../hooks/useRoleStats";
import { useAuth } from "../hooks/useAuth";
import { useAnalyticsData } from "../hooks/useBackendIntegration";
import type { EventData } from "../types/event";
import * as XLSX from "xlsx";

// Analytics utility functions
const calculateEventAnalytics = (
  upcomingEvents: EventData[],
  passedEvents: EventData[]
) => {
  // Ensure arrays are valid
  const safeUpcoming = Array.isArray(upcomingEvents) ? upcomingEvents : [];
  const safePassed = Array.isArray(passedEvents) ? passedEvents : [];

  // Total events
  const totalEvents = safeUpcoming.length + safePassed.length;

  // Event format distribution
  const formatStats = [...safeUpcoming, ...safePassed].reduce((acc, event) => {
    if (event && event.format && event.format.trim() !== "") {
      const format = event.format.trim();
      acc[format] = (acc[format] || 0) + 1;
    } else {
      console.warn("Event with missing or empty format:", {
        id: event?.id,
        title: event?.title,
        format: event?.format,
        formatType: typeof event?.format,
      });
    }
    return acc;
  }, {} as Record<string, number>);

  // Upcoming events stats
  const upcomingTotalSlots = safeUpcoming.reduce((sum, event) => {
    if (!event || !Array.isArray(event.roles)) return sum;
    return (
      sum +
      event.roles.reduce((roleSum, role) => {
        return roleSum + (role?.maxParticipants || 0);
      }, 0)
    );
  }, 0);

  const upcomingSignedUp = safeUpcoming.reduce((sum, event) => {
    if (!event || !Array.isArray(event.roles)) return sum;
    return (
      sum +
      event.roles.reduce((roleSum, role) => {
        return (
          roleSum +
          (Array.isArray(role?.currentSignups) ? role.currentSignups.length : 0)
        );
      }, 0)
    );
  }, 0);

  // Passed events stats
  const passedTotalSlots = safePassed.reduce((sum, event) => {
    if (!event || !Array.isArray(event.roles)) return sum;
    return (
      sum +
      event.roles.reduce((roleSum, role) => {
        return roleSum + (role?.maxParticipants || 0);
      }, 0)
    );
  }, 0);

  const passedSignedUp = safePassed.reduce((sum, event) => {
    if (!event || !Array.isArray(event.roles)) return sum;
    return (
      sum +
      event.roles.reduce((roleSum, role) => {
        return (
          roleSum +
          (Array.isArray(role?.currentSignups) ? role.currentSignups.length : 0)
        );
      }, 0)
    );
  }, 0);

  // Role popularity (across all events)
  const roleSignups = [...safeUpcoming, ...safePassed].reduce((acc, event) => {
    if (!event || !Array.isArray(event.roles)) return acc;
    event.roles.forEach((role) => {
      if (!role || !role.name) return;
      if (!acc[role.name]) {
        acc[role.name] = { signups: 0, maxSlots: 0, events: 0 };
      }
      acc[role.name].signups += Array.isArray(role.currentSignups)
        ? role.currentSignups.length
        : 0;
      acc[role.name].maxSlots += role.maxParticipants || 0;
      acc[role.name].events += 1;
    });
    return acc;
  }, {} as Record<string, { signups: number; maxSlots: number; events: number }>);

  // Participation by system authorization level
  const participationBySystemAuthorizationLevel = [
    ...safeUpcoming,
    ...safePassed,
  ]
    .flatMap((event) => {
      if (!event || !Array.isArray(event.roles)) return [];
      return event.roles.flatMap((role) =>
        Array.isArray(role?.currentSignups) ? role.currentSignups : []
      );
    })
    .reduce((acc, participant) => {
      if (!participant) return acc;
      const level = participant.systemAuthorizationLevel || "Unknown";
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Average signup rate
  const averageSignupRate =
    totalEvents > 0
      ? ((upcomingSignedUp + passedSignedUp) /
          (upcomingTotalSlots + passedTotalSlots)) *
        100
      : 0;

  return {
    totalEvents,
    upcomingEvents: upcomingEvents.length,
    passedEvents: passedEvents.length,
    formatStats,
    upcomingStats: {
      totalSlots: upcomingTotalSlots,
      signedUp: upcomingSignedUp,
      availableSlots: upcomingTotalSlots - upcomingSignedUp,
      fillRate:
        upcomingTotalSlots > 0
          ? (upcomingSignedUp / upcomingTotalSlots) * 100
          : 0,
    },
    passedStats: {
      totalSlots: passedTotalSlots,
      signedUp: passedSignedUp,
      fillRate:
        passedTotalSlots > 0 ? (passedSignedUp / passedTotalSlots) * 100 : 0,
    },
    roleSignups,
    participationBySystemAuthorizationLevel,
    averageSignupRate,
  };
};

const calculateUserEngagement = (
  upcomingEvents: EventData[],
  passedEvents: EventData[]
) => {
  // Ensure arrays are valid
  const safeUpcoming = Array.isArray(upcomingEvents) ? upcomingEvents : [];
  const safePassed = Array.isArray(passedEvents) ? passedEvents : [];

  // Build a map of user participation per event
  const userEventParticipation: Record<string, Set<string>> = {};
  const allSignups: any[] = [];

  [...safeUpcoming, ...safePassed].forEach((event) => {
    if (!event || !Array.isArray(event.roles)) return;

    event.roles.forEach((role) => {
      if (!Array.isArray(role?.currentSignups)) return;

      role.currentSignups.forEach((participant) => {
        if (!participant || !participant.userId) return;

        // Add to allSignups for other calculations
        allSignups.push(participant);

        // Get user key - participant.userId is already the string ID
        const userKey = participant.userId || String(participant.userId);

        // Initialize user's event set if it doesn't exist
        if (!userEventParticipation[userKey]) {
          userEventParticipation[userKey] = new Set();
        }

        // Add this event to the user's participation (Set handles duplicates)
        userEventParticipation[userKey].add(
          event.id || event.title || "unknown"
        );
      });
    });
  });

  // Count unique participants
  const uniqueParticipants = new Set(
    allSignups.map((p) => {
      return p.userId || String(p.userId);
    })
  ).size;

  // Convert event sets to counts for each user
  const userEventCounts = Object.entries(userEventParticipation).reduce(
    (acc, [userKey, eventSet]) => {
      acc[userKey] = eventSet.size;
      return acc;
    },
    {} as Record<string, number>
  );

  // Most active users
  const mostActiveUsers = Object.entries(userEventCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([userKey, count]) => {
      const participant = allSignups.find((p) => {
        return p.userId === userKey;
      });

      // Build name with proper fallbacks - participant has fields directly
      let name = "Unknown";
      if (participant) {
        const firstName = participant.firstName?.trim() || "";
        const lastName = participant.lastName?.trim() || "";
        const username = participant.username?.trim() || "";

        if (firstName && lastName) {
          name = `${firstName} ${lastName}`;
        } else if (firstName) {
          name = firstName;
        } else if (lastName) {
          name = lastName;
        } else if (username) {
          name = username;
        }
      }

      return {
        userId: userKey,
        name,
        roleInAtCloud:
          participant?.roleInAtCloud && participant.roleInAtCloud.trim()
            ? participant.roleInAtCloud
            : participant?.systemAuthorizationLevel &&
              participant.systemAuthorizationLevel.trim()
            ? participant.systemAuthorizationLevel
            : participant?.role || "Unknown",
        eventCount: count,
      };
    });

  // Engagement metrics
  const averageEventsPerUser =
    uniqueParticipants > 0 ? allSignups.length / uniqueParticipants : 0;

  return {
    uniqueParticipants,
    totalSignups: allSignups.length,
    mostActiveUsers,
    averageEventsPerUser,
  };
};

// Church Analytics
const calculateChurchAnalytics = (users: any[]) => {
  // Ensure users is an array
  const safeUsers = Array.isArray(users) ? users : [];

  // Weekly Church distribution
  const weeklyChurchStats = safeUsers.reduce((acc, user) => {
    if (user && user.weeklyChurch && user.weeklyChurch.trim()) {
      acc[user.weeklyChurch] = (acc[user.weeklyChurch] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Church Address distribution
  const churchAddressStats = safeUsers.reduce((acc, user) => {
    if (user && user.churchAddress && user.churchAddress.trim()) {
      acc[user.churchAddress] = (acc[user.churchAddress] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Users with church information
  const usersWithChurchInfo = safeUsers.filter(
    (user) =>
      (user && user.weeklyChurch && user.weeklyChurch.trim()) ||
      (user && user.churchAddress && user.churchAddress.trim())
  ).length;

  const usersWithoutChurchInfo = safeUsers.length - usersWithChurchInfo;

  return {
    weeklyChurchStats,
    churchAddressStats,
    usersWithChurchInfo,
    usersWithoutChurchInfo,
    totalChurches: Object.keys(weeklyChurchStats).length,
    totalChurchLocations: Object.keys(churchAddressStats).length,
    churchParticipationRate:
      safeUsers.length > 0 ? (usersWithChurchInfo / safeUsers.length) * 100 : 0,
  };
};

// Occupation Analytics
const calculateOccupationAnalytics = (users: any[]) => {
  // Ensure users is an array
  const safeUsers = Array.isArray(users) ? users : [];

  // Occupation distribution
  const occupationStats = safeUsers.reduce((acc, user) => {
    if (user && user.occupation && user.occupation.trim()) {
      acc[user.occupation] = (acc[user.occupation] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Users with occupation information
  const usersWithOccupation = safeUsers.filter(
    (user) => user && user.occupation && user.occupation.trim()
  ).length;
  const usersWithoutOccupation = safeUsers.length - usersWithOccupation;

  // Most common occupations (top 5)
  const topOccupations = Object.entries(occupationStats)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([occupation, count]) => ({ occupation, count: count as number }));

  return {
    occupationStats,
    usersWithOccupation,
    usersWithoutOccupation,
    totalOccupationTypes: Object.keys(occupationStats).length,
    topOccupations,
    occupationCompletionRate:
      safeUsers.length > 0 ? (usersWithOccupation / safeUsers.length) * 100 : 0,
  };
};

export default function Analytics() {
  const { currentUser } = useAuth();
  const { users } = useUserData();
  const roleStats = useRoleStats(users);

  // Check if user has access to analytics
  const hasAnalyticsAccess =
    currentUser &&
    ["Super Admin", "Administrator", "Leader"].includes(currentUser.role);

  // If user doesn't have access, show unauthorized message
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z"
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
          </div>
        </div>
      </div>
    );
  }

  // Use real backend analytics data
  const { eventAnalytics: backendEventAnalytics } = useAnalyticsData();

  // Fallback to empty arrays if backend data not available
  const upcomingEvents: EventData[] =
    backendEventAnalytics?.upcomingEvents || [];
  const passedEvents: EventData[] =
    backendEventAnalytics?.completedEvents || [];

  const eventAnalytics = useMemo(
    () => calculateEventAnalytics(upcomingEvents, passedEvents),
    [upcomingEvents, passedEvents]
  );

  const engagementMetrics = useMemo(
    () => calculateUserEngagement(upcomingEvents, passedEvents),
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

  // Check if user has export permissions
  const canExport =
    currentUser &&
    ["Super Admin", "Administrator", "Leader"].includes(currentUser.role);

  // Export function
  const handleExportData = () => {
    if (!canExport) return;

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Overview data
    const overviewData = [
      ["Metric", "Value"],
      ["Total Events", eventAnalytics.totalEvents],
      ["Total Users", roleStats.total],
      ["Active Participants", engagementMetrics.uniqueParticipants],
      [
        "Average Signup Rate",
        `${eventAnalytics.averageSignupRate.toFixed(1)}%`,
      ],
    ];
    const overviewWS = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewWS, "Overview");

    // Event statistics
    const eventStatsData = [
      ["Event Type", "Total Events", "Total Slots", "Signed Up", "Fill Rate"],
      [
        "Upcoming Events",
        eventAnalytics.upcomingEvents,
        eventAnalytics.upcomingStats.totalSlots,
        eventAnalytics.upcomingStats.signedUp,
        `${eventAnalytics.upcomingStats.fillRate.toFixed(1)}%`,
      ],
      [
        "Past Events",
        eventAnalytics.passedEvents,
        eventAnalytics.passedStats.totalSlots,
        eventAnalytics.passedStats.signedUp,
        `${eventAnalytics.passedStats.fillRate.toFixed(1)}%`,
      ],
    ];
    const eventStatsWS = XLSX.utils.aoa_to_sheet(eventStatsData);
    XLSX.utils.book_append_sheet(wb, eventStatsWS, "Event Statistics");

    // Role distribution
    const roleDistributionData = [
      ["Role Type", "Count"],
      ["Super Admin", roleStats.superAdmin],
      ["Administrators", roleStats.administrators],
      ["Leaders", roleStats.leaders],
      ["Participants", roleStats.participants],
      ["@Cloud Leaders or Co-workers", roleStats.atCloudLeaders],
    ];
    const roleDistributionWS = XLSX.utils.aoa_to_sheet(roleDistributionData);
    XLSX.utils.book_append_sheet(wb, roleDistributionWS, "Role Distribution");

    // Event format distribution
    const formatData = [
      ["Format", "Count"],
      ...Object.entries(eventAnalytics.formatStats),
    ];
    const formatWS = XLSX.utils.aoa_to_sheet(formatData);
    XLSX.utils.book_append_sheet(wb, formatWS, "Event Formats");

    // Most active users
    const activeUsersData = [
      ["Rank", "Name", "Role (@Cloud / System Level)", "Event Count"],
      ...engagementMetrics.mostActiveUsers.map((user, index) => [
        index + 1,
        user.name,
        user.roleInAtCloud,
        user.eventCount,
      ]),
    ];
    const activeUsersWS = XLSX.utils.aoa_to_sheet(activeUsersData);
    XLSX.utils.book_append_sheet(wb, activeUsersWS, "Most Active Users");

    // Engagement summary
    const engagementData = [
      ["Metric", "Value"],
      ["Total Event Signups", engagementMetrics.totalSignups],
      ["Unique Participants", engagementMetrics.uniqueParticipants],
      [
        "Average Events per User",
        engagementMetrics.averageEventsPerUser.toFixed(1),
      ],
    ];
    const engagementWS = XLSX.utils.aoa_to_sheet(engagementData);
    XLSX.utils.book_append_sheet(wb, engagementWS, "Engagement Summary");

    // Church analytics
    const churchData = [
      ["Metric", "Value"],
      ["Total Churches", churchAnalytics.totalChurches],
      ["Total Church Locations", churchAnalytics.totalChurchLocations],
      [
        "Church Participation Rate",
        `${churchAnalytics.churchParticipationRate.toFixed(1)}%`,
      ],
      ["Users with Church Info", churchAnalytics.usersWithChurchInfo],
      ["Users without Church Info", churchAnalytics.usersWithoutChurchInfo],
    ];
    const churchWS = XLSX.utils.aoa_to_sheet(churchData);
    XLSX.utils.book_append_sheet(wb, churchWS, "Church Analytics");

    // Occupation analytics
    const occupationData = [
      ["Metric", "Value"],
      ["Total Occupation Types", occupationAnalytics.totalOccupationTypes],
      ["Users with Occupation Info", occupationAnalytics.usersWithOccupation],
      [
        "Users without Occupation Info",
        occupationAnalytics.usersWithoutOccupation,
      ],
      [
        "Occupation Completion Rate",
        `${occupationAnalytics.occupationCompletionRate.toFixed(1)}%`,
      ],
    ];
    const occupationWS = XLSX.utils.aoa_to_sheet(occupationData);
    XLSX.utils.book_append_sheet(wb, occupationWS, "Occupation Analytics");

    // Generate filename with current date
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD format
    const filename = `Analytics_Report_${dateStr}.xlsx`;

    // Write and download the file
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Analytics Dashboard
          </h1>
          {canExport && (
            <button
              onClick={handleExportData}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">
                  Total Events
                </p>
                <p className="text-2xl font-semibold text-blue-900">
                  {eventAnalytics.totalEvents}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">
                  Total Users
                </p>
                <p className="text-2xl font-semibold text-green-900">
                  {roleStats.total}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">
                  Active Participants
                </p>
                <p className="text-2xl font-semibold text-purple-900">
                  {engagementMetrics.uniqueParticipants}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-orange-600">
                  Avg. Signup Rate
                </p>
                <p className="text-2xl font-semibold text-orange-900">
                  {eventAnalytics.averageSignupRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Event Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Upcoming Events Stats */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Upcoming Events
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Events:</span>
                <span className="font-medium">
                  {eventAnalytics.upcomingEvents}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Slots:</span>
                <span className="font-medium">
                  {eventAnalytics.upcomingStats.totalSlots}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Signed Up:</span>
                <span className="font-medium text-green-600">
                  {eventAnalytics.upcomingStats.signedUp}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Available:</span>
                <span className="font-medium text-blue-600">
                  {eventAnalytics.upcomingStats.availableSlots}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Fill Rate:</span>
                <span className="font-medium">
                  {eventAnalytics.upcomingStats.fillRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${eventAnalytics.upcomingStats.fillRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Past Events Stats */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Past Events
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Events:</span>
                <span className="font-medium">
                  {eventAnalytics.passedEvents}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Slots:</span>
                <span className="font-medium">
                  {eventAnalytics.passedStats.totalSlots}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Signups:</span>
                <span className="font-medium text-green-600">
                  {eventAnalytics.passedStats.signedUp}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Fill Rate:</span>
                <span className="font-medium">
                  {eventAnalytics.passedStats.fillRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${eventAnalytics.passedStats.fillRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* User Role Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              System Authorization Level Distribution
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Super Admin:</span>
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                  {roleStats.superAdmin}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Administrators:</span>
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                  {roleStats.administrators}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Leaders:</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  {roleStats.leaders}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Participants:</span>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  {roleStats.participants}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  @Cloud Leaders and Co-workers:
                </span>
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                  {roleStats.atCloudLeaders}
                </span>
              </div>
            </div>
          </div>

          {/* Event Format Distribution */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Event Format Distribution
            </h3>
            <div className="space-y-3">
              {Object.entries(eventAnalytics.formatStats).map(
                ([format, count]) => {
                  return (
                    <div
                      key={format}
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm text-gray-600">{format}:</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        {count}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* Most Active Users and Engagement Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Most Active Users */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Most Active Participants
            </h3>
            <div className="space-y-3">
              {engagementMetrics.mostActiveUsers.map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.roleInAtCloud}
                      </p>
                    </div>
                  </div>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                    {user.eventCount} events
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Engagement Summary */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Engagement Summary
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Total Role Signups:
                </span>
                <span className="font-medium">
                  {engagementMetrics.totalSignups}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Unique Participants:
                </span>
                <span className="font-medium">
                  {engagementMetrics.uniqueParticipants}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Total Unique Events:
                </span>
                <span className="font-medium">
                  {eventAnalytics.totalEvents}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Avg. Roles per Participant:
                </span>
                <span className="font-medium">
                  {engagementMetrics.uniqueParticipants > 0
                    ? (
                        engagementMetrics.totalSignups /
                        engagementMetrics.uniqueParticipants
                      ).toFixed(1)
                    : "0.0"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Church and Occupation Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Church Analytics */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Church Statistics
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Churches:</span>
                <span className="font-medium">
                  {churchAnalytics.totalChurches}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Church Locations:</span>
                <span className="font-medium">
                  {churchAnalytics.totalChurchLocations}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Users with Church Info:
                </span>
                <span className="font-medium text-green-600">
                  {churchAnalytics.usersWithChurchInfo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Participation Rate:
                </span>
                <span className="font-medium">
                  {churchAnalytics.churchParticipationRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full"
                  style={{
                    width: `${churchAnalytics.churchParticipationRate}%`,
                  }}
                ></div>
              </div>

              {/* Top Churches */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Most Common Churches:
                </h4>
                <div className="space-y-2">
                  {Object.entries(churchAnalytics.weeklyChurchStats)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 3)
                    .map(([church, count]) => (
                      <div
                        key={church}
                        className="flex justify-between text-xs"
                      >
                        <span className="text-gray-600 truncate">{church}</span>
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                          {count as number}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Occupation Analytics */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Occupation Statistics
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Total Occupations:
                </span>
                <span className="font-medium">
                  {occupationAnalytics.totalOccupationTypes}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Users with Occupation:
                </span>
                <span className="font-medium text-green-600">
                  {occupationAnalytics.usersWithOccupation}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Completion Rate:</span>
                <span className="font-medium">
                  {occupationAnalytics.occupationCompletionRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{
                    width: `${occupationAnalytics.occupationCompletionRate}%`,
                  }}
                ></div>
              </div>

              {/* Top Occupations */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Most Common Occupations:
                </h4>
                <div className="space-y-2">
                  {occupationAnalytics.topOccupations.map(
                    ({ occupation, count }) => (
                      <div
                        key={occupation}
                        className="flex justify-between text-xs"
                      >
                        <span className="text-gray-600 truncate">
                          {occupation}
                        </span>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                          {count}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
