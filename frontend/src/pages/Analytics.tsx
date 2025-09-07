import { useMemo } from "react";
import { useUserData } from "../hooks/useUserData";
import { useRoleStats } from "../hooks/useRoleStats";
import { useAuth } from "../hooks/useAuth";
import { useAnalyticsData } from "../hooks/useBackendIntegration";
import {
  getRoleBadgeClassNames,
  getEngagementBadgeClassNames,
} from "../constants/ui";
import type { EventData } from "../types/event";
// Removed local XLSX export in favor of comprehensive backend export

// Minimal, runtime-checked shapes to avoid `any` while supporting mixed backend data
type ParticipantLike = {
  userId?: string | number;
  username?: string;
  firstName?: string;
  lastName?: string;
  systemAuthorizationLevel?: string;
  roleInAtCloud?: string;
  role?: string;
};

type RegistrationLike = {
  userId?: string | number;
  user?: ParticipantLike;
};

type RoleLike = {
  name?: string;
  maxParticipants?: number;
  currentSignups?: unknown;
  registrations?: unknown;
  currentCount?: unknown;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";

const toParticipant = (p: unknown): ParticipantLike | null => {
  if (!isObject(p)) return null;
  const obj = p as Record<string, unknown>;
  const fromUser = isObject(obj.user) ? (obj.user as ParticipantLike) : null;
  if (fromUser) {
    return {
      userId:
        typeof fromUser.userId === "string" ||
        typeof fromUser.userId === "number"
          ? fromUser.userId
          : typeof obj.userId === "string" || typeof obj.userId === "number"
          ? (obj.userId as string | number)
          : undefined,
      username:
        typeof fromUser.username === "string" ? fromUser.username : undefined,
      firstName:
        typeof fromUser.firstName === "string" ? fromUser.firstName : undefined,
      lastName:
        typeof fromUser.lastName === "string" ? fromUser.lastName : undefined,
      systemAuthorizationLevel:
        typeof fromUser.systemAuthorizationLevel === "string"
          ? fromUser.systemAuthorizationLevel
          : undefined,
      roleInAtCloud:
        typeof fromUser.roleInAtCloud === "string"
          ? fromUser.roleInAtCloud
          : undefined,
      role: typeof fromUser.role === "string" ? fromUser.role : undefined,
    };
  }

  return {
    userId:
      typeof obj.userId === "string" || typeof obj.userId === "number"
        ? (obj.userId as string | number)
        : undefined,
    username:
      typeof obj.username === "string" ? (obj.username as string) : undefined,
    firstName:
      typeof obj.firstName === "string" ? (obj.firstName as string) : undefined,
    lastName:
      typeof obj.lastName === "string" ? (obj.lastName as string) : undefined,
    systemAuthorizationLevel:
      typeof obj.systemAuthorizationLevel === "string"
        ? (obj.systemAuthorizationLevel as string)
        : undefined,
    roleInAtCloud:
      typeof obj.roleInAtCloud === "string"
        ? (obj.roleInAtCloud as string)
        : undefined,
    role: typeof obj.role === "string" ? (obj.role as string) : undefined,
  };
};

const getRoleParticipants = (role: unknown): ParticipantLike[] => {
  if (!isObject(role)) return [];
  const r = role as RoleLike;
  // Prefer currentSignups when it looks like an array of participants
  if (Array.isArray(r.currentSignups)) {
    return r.currentSignups
      .map((p) => toParticipant(p))
      .filter(Boolean) as ParticipantLike[];
  }
  // Fallback to registrations array from backend
  if (Array.isArray(r.registrations)) {
    return (r.registrations as RegistrationLike[])
      .map((reg) => toParticipant(reg))
      .filter(Boolean) as ParticipantLike[];
  }
  return [];
};

const getRoleSignupCount = (role: unknown): number => {
  if (!isObject(role)) return 0;
  const r = role as RoleLike;
  const participants = getRoleParticipants(role);
  if (participants.length > 0) return participants.length;
  return typeof r.currentCount === "number" ? r.currentCount : 0;
};

const getRoleName = (role: unknown): string | undefined => {
  return isObject(role) && typeof (role as RoleLike).name === "string"
    ? ((role as RoleLike).name as string)
    : undefined;
};

const getRoleMaxParticipants = (role: unknown): number => {
  return isObject(role) &&
    typeof (role as RoleLike).maxParticipants === "number"
    ? ((role as RoleLike).maxParticipants as number)
    : 0;
};

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
      event.roles.reduce(
        (roleSum, role) => roleSum + getRoleMaxParticipants(role),
        0
      )
    );
  }, 0);

  const upcomingSignedUp = safeUpcoming.reduce((sum, event) => {
    if (!event || !Array.isArray(event.roles)) return sum;
    return (
      sum +
      event.roles.reduce(
        (roleSum, role) => roleSum + getRoleSignupCount(role),
        0
      )
    );
  }, 0);

  // Passed events stats
  const passedTotalSlots = safePassed.reduce((sum, event) => {
    if (!event || !Array.isArray(event.roles)) return sum;
    return (
      sum +
      event.roles.reduce(
        (roleSum, role) => roleSum + getRoleMaxParticipants(role),
        0
      )
    );
  }, 0);

  const passedSignedUp = safePassed.reduce((sum, event) => {
    if (!event || !Array.isArray(event.roles)) return sum;
    return (
      sum +
      event.roles.reduce(
        (roleSum, role) => roleSum + getRoleSignupCount(role),
        0
      )
    );
  }, 0);

  // Role popularity (across all events)
  const roleSignups = [...safeUpcoming, ...safePassed].reduce((acc, event) => {
    if (!event || !Array.isArray(event.roles)) return acc;
    event.roles.forEach((role) => {
      const name = getRoleName(role);
      if (!name) return;
      if (!acc[name]) {
        acc[name] = { signups: 0, maxSlots: 0, events: 0 };
      }
      acc[name].signups += getRoleSignupCount(role);
      acc[name].maxSlots += getRoleMaxParticipants(role);
      acc[name].events += 1;
    });
    return acc;
  }, {} as Record<string, { signups: number; maxSlots: number; events: number }>);

  // Participation by system authorization level
  const participationBySystemAuthorizationLevel = [
    ...safeUpcoming,
    ...safePassed,
  ]
    .flatMap((event) => {
      if (!event || !Array.isArray(event.roles)) return [] as ParticipantLike[];
      return event.roles.flatMap((role) => getRoleParticipants(role));
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
  const allSignups: ParticipantLike[] = [];

  [...safeUpcoming, ...safePassed].forEach((event) => {
    if (!event || !Array.isArray(event.roles)) return;

    event.roles.forEach((role) => {
      const signups = getRoleParticipants(role);

      signups.forEach((participant) => {
        if (!participant || !participant.userId) return;

        // Add to allSignups for other calculations
        allSignups.push(participant);

        // Get user key - participant.userId is already the string ID
        const userKey = String(participant.userId);

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
    allSignups.map((p) => p?.userId).filter(Boolean)
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
    // Keep user-only signups separate so we can include guests only where intended
    userSignups: allSignups.length,
    mostActiveUsers,
    averageEventsPerUser,
  };
};

// Guest analytics derived from event roles
// Contract:
// - guestSignups: total guest registrations across all roles/events (count-based)
// - uniqueGuests: approximated as guestSignups since guest identities are not provided in analytics payload
//   Assumption: analytics event data exposes per-role currentCount (users + guests)
//   and registrations[] (users). We treat guests = max(0, currentCount - registrations.length).
const calculateGuestAggregates = (
  upcomingEvents: EventData[],
  passedEvents: EventData[]
) => {
  const safeUpcoming = Array.isArray(upcomingEvents) ? upcomingEvents : [];
  const safePassed = Array.isArray(passedEvents) ? passedEvents : [];
  let guestSignups = 0;

  for (const event of [...safeUpcoming, ...safePassed]) {
    if (!event || !Array.isArray(event.roles)) continue;
    for (const role of event.roles) {
      const userCount = getRoleParticipants(role).length; // from registrations/currentSignups
      const combinedCount = (() => {
        if (
          isObject(role) &&
          typeof (role as RoleLike).currentCount === "number"
        ) {
          return (role as RoleLike).currentCount as number;
        }
        // Fallback to user-only count when combined count isn't present
        return userCount;
      })();
      const guestsForRole = Math.max(0, combinedCount - userCount);
      guestSignups += guestsForRole;
    }
  }

  // Without stable guest identity in analytics payload, use count as an approximation of uniqueness
  const uniqueGuests = guestSignups;
  return { guestSignups, uniqueGuests };
};

// Church Analytics
type ChurchAnalytics = {
  weeklyChurchStats: Record<string, number>;
  churchAddressStats: Record<string, number>;
  usersWithChurchInfo: number;
  usersWithoutChurchInfo: number;
  totalChurches: number;
  totalChurchLocations: number;
  churchParticipationRate: number;
};

const calculateChurchAnalytics = (users: unknown[]): ChurchAnalytics => {
  // Ensure users is an array
  const safeUsers = Array.isArray(users) ? users : [];

  // Weekly Church distribution
  const weeklyChurchStats = safeUsers.reduce<Record<string, number>>(
    (acc, u) => {
      const user = u as { weeklyChurch?: unknown };
      if (typeof user.weeklyChurch === "string" && user.weeklyChurch.trim()) {
        const key = user.weeklyChurch;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    },
    {}
  );

  // Church Address distribution
  const churchAddressStats = safeUsers.reduce<Record<string, number>>(
    (acc, u) => {
      const user = u as { churchAddress?: unknown };
      if (typeof user.churchAddress === "string" && user.churchAddress.trim()) {
        const key = user.churchAddress;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    },
    {}
  );

  // Users with church information
  const usersWithChurchInfo = safeUsers.filter((u) => {
    const user = u as { weeklyChurch?: unknown; churchAddress?: unknown };
    const wc =
      typeof user.weeklyChurch === "string" &&
      user.weeklyChurch.trim().length > 0;
    const ca =
      typeof user.churchAddress === "string" &&
      user.churchAddress.trim().length > 0;
    return wc || ca;
  }).length;

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
type OccupationAnalytics = {
  occupationStats: Record<string, number>;
  usersWithOccupation: number;
  usersWithoutOccupation: number;
  totalOccupationTypes: number;
  topOccupations: Array<{ occupation: string; count: number }>;
  occupationCompletionRate: number;
};

const calculateOccupationAnalytics = (
  users: unknown[]
): OccupationAnalytics => {
  // Ensure users is an array
  const safeUsers = Array.isArray(users) ? users : [];

  // Occupation distribution
  const occupationStats = safeUsers.reduce<Record<string, number>>((acc, u) => {
    const user = u as { occupation?: unknown };
    if (typeof user.occupation === "string" && user.occupation.trim()) {
      const key = user.occupation;
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});

  // Users with occupation information
  const usersWithOccupation = safeUsers.filter((u) => {
    const user = u as { occupation?: unknown };
    return typeof user.occupation === "string" && user.occupation.trim();
  }).length;
  const usersWithoutOccupation = safeUsers.length - usersWithOccupation;

  // Most common occupations (top 5)
  const topOccupations = Object.entries(occupationStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([occupation, count]) => ({ occupation, count }));

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
  // Use real backend analytics data (hooks must be top-level, never conditional)
  const hasAnalyticsAccess =
    !!currentUser &&
    ["Super Admin", "Administrator", "Leader"].includes(currentUser.role);

  const { eventAnalytics: backendEventAnalytics, exportData } =
    useAnalyticsData({
      enabled: hasAnalyticsAccess,
      suppressAuthErrors: !hasAnalyticsAccess,
    });

  // Check if user has access to analytics

  // Type guard and stable derivations for backend arrays
  const isEventData = (item: unknown): item is EventData => {
    if (!item || typeof item !== "object") return false;
    const e = item as Partial<EventData> & { [k: string]: unknown };
    return (
      typeof e.id === "string" &&
      typeof e.title === "string" &&
      Array.isArray((e as { roles?: unknown }).roles)
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

  // Derived: average roles per participant (total role signups divided by unique participants)
  const avgRolesPerParticipant = useMemo(() => {
    return engagementMetrics.uniqueParticipants > 0
      ? engagementMetrics.userSignups / engagementMetrics.uniqueParticipants
      : 0;
  }, [engagementMetrics.userSignups, engagementMetrics.uniqueParticipants]);

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

  // If user doesn't have access, show unauthorized message (placed after hooks to avoid conditional hook calls)
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
              @Cloud Leaders for authorization.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has export permissions
  const canExport =
    !!currentUser &&
    ["Super Admin", "Administrator", "Leader"].includes(currentUser.role);

  // Export function (use comprehensive backend export)
  const handleExportData = () => {
    if (!canExport) return;
    // Default to xlsx; backend supports csv|xlsx|json
    exportData("xlsx");
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
                <span
                  className={`${getRoleBadgeClassNames(
                    "Super Admin"
                  )} px-2 py-1 rounded-full text-xs font-medium`}
                >
                  {roleStats.superAdmin}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Administrators:</span>
                <span
                  className={`${getRoleBadgeClassNames(
                    "Administrator"
                  )} px-2 py-1 rounded-full text-xs font-medium`}
                >
                  {roleStats.administrators}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Leaders:</span>
                <span
                  className={`${getRoleBadgeClassNames(
                    "Leader"
                  )} px-2 py-1 rounded-full text-xs font-medium`}
                >
                  {roleStats.leaders}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Guest Experts:</span>
                <span
                  className={`${getRoleBadgeClassNames(
                    "Guest Expert"
                  )} px-2 py-1 rounded-full text-xs font-medium`}
                >
                  {roleStats.guestExperts}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Participants:</span>
                <span
                  className={`${getRoleBadgeClassNames(
                    "Participant"
                  )} px-2 py-1 rounded-full text-xs font-medium`}
                >
                  {roleStats.participants}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  @Cloud Co-workers:
                </span>
                <span
                  className={`${getRoleBadgeClassNames(
                    "@Cloud Co-workers"
                  )} px-2 py-1 rounded-full text-xs font-medium`}
                >
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
              {engagementMetrics.mostActiveUsers.length === 0 ? (
                <p className="text-sm text-gray-500">No data available.</p>
              ) : (
                engagementMetrics.mostActiveUsers.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-700 truncate">
                      {user.name}
                    </span>
                    <span
                      className={`${getEngagementBadgeClassNames(
                        user.eventCount
                      )} px-2 py-1 rounded-full text-xs font-medium`}
                    >
                      {user.eventCount}{" "}
                      {user.eventCount === 1 ? "event" : "events"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Engagement Summary */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Engagement Summary
            </h3>
            <div className="space-y-3">
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
                  Total Role Signups:
                </span>
                <span className="font-medium">
                  {engagementMetrics.userSignups}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Guest Signups:</span>
                <span className="font-medium">
                  {guestAggregates.guestSignups}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Unique Guests:</span>
                <span className="font-medium">
                  {guestAggregates.uniqueGuests}
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
                  {avgRolesPerParticipant.toFixed(1)}
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
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([church, count]) => (
                      <div
                        key={church}
                        className="flex justify-between text-xs"
                      >
                        <span className="text-gray-600 truncate">{church}</span>
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                          {count}
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
