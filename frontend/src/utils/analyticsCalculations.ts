import type { EventData } from "../types/event";

// --------- Generic Narrowed Types / Helpers ---------
export type ParticipantLike = {
  userId?: string | number;
  firstName?: string;
  lastName?: string;
  username?: string;
  roleInAtCloud?: string;
  systemAuthorizationLevel?: string;
  role?: string;
};

type RoleLike = {
  name?: string;
  maxParticipants?: number;
  currentSignups?: unknown[];
  registrations?: unknown[];
  currentCount?: number;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";

interface CurrentSignupLike {
  userId?: string | number;
  firstName?: string;
  lastName?: string;
  username?: string;
  systemAuthorizationLevel?: string;
  roleInAtCloud?: string;
  role?: string;
}

interface RegistrationLike {
  userId?: string | number;
  user?: CurrentSignupLike & { id?: string | number };
  firstName?: string; // sometimes flattened already
  lastName?: string;
  username?: string;
  systemAuthorizationLevel?: string;
  roleInAtCloud?: string;
  role?: string;
}

interface RoleUnknownShape {
  currentSignups?: CurrentSignupLike[];
  registrations?: RegistrationLike[];
  currentCount?: number;
  name?: string;
  maxParticipants?: number;
}

const getRoleParticipants = (role: unknown): ParticipantLike[] => {
  if (!isObject(role)) return [];
  const r = role as RoleUnknownShape;
  if (Array.isArray(r.currentSignups)) {
    return r.currentSignups
      .map((p): ParticipantLike | null => {
        if (!p || typeof p !== "object") return null;
        if (!p.userId) return null; // must have userId to count
        return {
          userId: p.userId,
          firstName: p.firstName,
          lastName: p.lastName,
          username: p.username,
          systemAuthorizationLevel: p.systemAuthorizationLevel,
          roleInAtCloud: p.roleInAtCloud,
          role: p.role,
        };
      })
      .filter(Boolean) as ParticipantLike[];
  }
  if (Array.isArray(r.registrations)) {
    return r.registrations
      .map((p): ParticipantLike | null => {
        if (!p || typeof p !== "object") return null;
        if (p.user && typeof p.user === "object") {
          const nested = p.user;
          return {
            userId: p.userId ?? nested.id,
            firstName: nested.firstName ?? p.firstName,
            lastName: nested.lastName ?? p.lastName,
            username: nested.username ?? p.username,
            systemAuthorizationLevel:
              nested.systemAuthorizationLevel ?? p.systemAuthorizationLevel,
            roleInAtCloud: nested.roleInAtCloud ?? p.roleInAtCloud,
            role: nested.role ?? p.role,
          };
        }
        // fallback flattened case
        if (!p.userId) return null;
        return {
          userId: p.userId,
          firstName: p.firstName,
          lastName: p.lastName,
          username: p.username,
          systemAuthorizationLevel: p.systemAuthorizationLevel,
          roleInAtCloud: p.roleInAtCloud,
          role: p.role,
        };
      })
      .filter(Boolean) as ParticipantLike[];
  }
  return [];
};

const getRoleSignupCount = (role: unknown): number => {
  if (!isObject(role)) return 0;
  const participants = getRoleParticipants(role);
  if (participants.length > 0) return participants.length;
  return typeof (role as RoleLike).currentCount === "number"
    ? ((role as RoleLike).currentCount as number)
    : 0;
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
export const calculateEventAnalytics = (
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

export const calculateUserEngagement = (
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
    .slice(0, 6)
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
export const calculateGuestAggregates = (
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
export type ChurchAnalytics = {
  weeklyChurchStats: Record<string, number>;
  churchAddressStats: Record<string, number>;
  usersWithChurchInfo: number;
  usersWithoutChurchInfo: number;
  totalChurches: number;
  totalChurchLocations: number;
  churchParticipationRate: number;
};

export const calculateChurchAnalytics = (users: unknown[]): ChurchAnalytics => {
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
export type OccupationAnalytics = {
  occupationStats: Record<string, number>;
  usersWithOccupation: number;
  usersWithoutOccupation: number;
  totalOccupationTypes: number;
  topOccupations: Array<{ occupation: string; count: number }>;
  occupationCompletionRate: number;
};

export const calculateOccupationAnalytics = (
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
