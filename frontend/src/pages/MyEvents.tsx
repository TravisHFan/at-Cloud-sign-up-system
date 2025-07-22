import { useState, useMemo } from "react";
import { useUserEvents } from "../hooks/useEventsApi";
import { formatEventDate, formatEventTime } from "../utils/eventStatsUtils";
import { Badge } from "../components/ui";
import { useNavigate } from "react-router-dom";

interface MyEventItem {
  event: {
    id: string;
    title: string;
    date: string;
    time: string;
    endTime?: string;
    location: string;
    format: string;
    status: string;
    type: string;
    organizer: string;
    createdAt: string;
  };
  registrations: Array<{
    id: string;
    roleId: string;
    roleName: string;
    roleDescription?: string;
    registrationDate: string;
    status: "active" | "waitlisted" | "attended" | "no_show";
    notes?: string;
    specialRequirements?: string;
  }>;
  isPassedEvent: boolean;
  eventStatus: "upcoming" | "passed";
}

export default function MyEvents() {
  const navigate = useNavigate();
  const {
    events: rawEvents,
    stats,
    loading,
    error,
    refreshEvents,
  } = useUserEvents();
  const [filter, setFilter] = useState<"all" | "upcoming" | "passed">("all");

  // Parse and group the events data by event ID
  const events: MyEventItem[] = useMemo(() => {
    if (!rawEvents || !Array.isArray(rawEvents)) {
      return [];
    }

    // Group registrations by event ID
    const eventGroups = new Map<string, MyEventItem>();

    rawEvents.forEach((item: any) => {
      const eventId = item.event.id;

      if (eventGroups.has(eventId)) {
        // Add registration to existing event
        const existingEvent = eventGroups.get(eventId)!;
        existingEvent.registrations.push(item.registration);
      } else {
        // Create new event with first registration
        eventGroups.set(eventId, {
          event: item.event,
          registrations: [item.registration],
          isPassedEvent: item.isPassedEvent,
          eventStatus: item.eventStatus,
        });
      }
    });

    return Array.from(eventGroups.values());
  }, [rawEvents]);

  // Filter events based on selected filters
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Filter by event timing
    if (filter === "upcoming") {
      filtered = filtered.filter((item) => !item.isPassedEvent);
    } else if (filter === "passed") {
      filtered = filtered.filter((item) => item.isPassedEvent);
    }

    // Only show events with at least one active registration
    filtered = filtered.filter((item) =>
      item.registrations.some((reg) => reg.status === "active")
    );

    return filtered;
  }, [events, filter]);

  const getStatusBadges = (
    registrations: MyEventItem["registrations"],
    isPassedEvent: boolean
  ) => {
    if (isPassedEvent) {
      // For passed events, show individual status badges for each role
      return registrations.map((reg, index) => {
        let badgeVariant: "success" | "error" | "warning" | "neutral" | "info" =
          "neutral";
        let badgeText = "";

        if (reg.status === "attended") {
          badgeVariant = "success";
          badgeText = "Attended";
        } else if (reg.status === "no_show") {
          badgeVariant = "error";
          badgeText = "No Show";
        } else {
          badgeVariant = "neutral";
          badgeText = "Completed";
        }

        return (
          <Badge key={`${reg.id}-${index}`} variant={badgeVariant}>
            {badgeText}
          </Badge>
        );
      });
    } else {
      // For upcoming events, show a single badge with role count
      const activeRoles = registrations.filter(
        (reg) => reg.status === "active"
      );
      const waitlistedRoles = registrations.filter(
        (reg) => reg.status === "waitlisted"
      );

      const badges = [];

      if (activeRoles.length > 0) {
        const roleText =
          activeRoles.length === 1
            ? "1 Role Registered"
            : `${activeRoles.length} Roles Registered`;
        badges.push(
          <Badge key="active-roles" variant="success">
            {roleText}
          </Badge>
        );
      }

      if (waitlistedRoles.length > 0) {
        const waitlistText =
          waitlistedRoles.length === 1
            ? "1 Role Waitlisted"
            : `${waitlistedRoles.length} Roles Waitlisted`;
        badges.push(
          <Badge key="waitlisted-roles" variant="warning">
            {waitlistText}
          </Badge>
        );
      }

      return badges;
    }
  };

  const getEventTypeBadge = (eventStatus: string) => {
    if (eventStatus === "upcoming") {
      return <Badge variant="info">Upcoming</Badge>;
    }
    return <Badge variant="neutral">Passed</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64">
        <div className="text-red-600 mb-4">Error loading events: {error}</div>
        <button
          onClick={refreshEvents}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Events</h1>
        <p className="text-gray-600 mt-1">
          View and manage all your event registrations in one place
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg
                className="w-6 h-6 text-blue-600"
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
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Upcoming</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.upcoming}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <svg
                className="w-6 h-6 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.passed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Filter Dropdown */}
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="w-full md:w-80 pl-3 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Events</option>
              <option value="upcoming">Upcoming Events</option>
              <option value="passed">Passed Events</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-gray-600 mt-4">
          Showing {filteredEvents.length} of {events.length} events
        </p>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Events Found
            </h3>
            <p className="text-gray-600 mb-4">
              {filter === "all"
                ? "You haven't registered for any events yet."
                : `No ${filter} events found with the selected filters.`}
            </p>
            <button
              onClick={() => navigate("/dashboard/upcoming")}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Browse Events
            </button>
          </div>
        ) : (
          filteredEvents.map((item) => (
            <div
              key={item.event.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {item.event.title}
                </h3>
                <div className="flex items-center space-x-2">
                  {getEventTypeBadge(item.eventStatus)}
                  <div className="flex gap-2">
                    {getStatusBadges(item.registrations, item.isPassedEvent)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
                <div className="flex items-center">
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {formatEventDate(item.event.date)}
                </div>
                <div className="flex items-center">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {formatEventTime(item.event.time)}
                  {item.event.endTime &&
                    ` - ${formatEventTime(item.event.endTime)}`}
                </div>
                <div className="flex items-center">
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
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {item.event.location}
                </div>
                <div className="flex items-center">
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {item.event.organizer}
                </div>
              </div>

              {/* Additional Registration Details */}
              <div className="mb-4 text-sm text-gray-600">
                <div className="flex items-center mb-2">
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
                      d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 002 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2v-8a2 2 0 012-2V6"
                    />
                  </svg>
                  <span>
                    Role(s):{" "}
                    <strong>
                      {item.registrations.map((reg) => reg.roleName).join(", ")}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  First Registered:{" "}
                  {new Date(
                    Math.min(
                      ...item.registrations.map((reg) =>
                        new Date(reg.registrationDate).getTime()
                      )
                    )
                  ).toLocaleDateString()}
                </div>
              </div>

              {/* Notes */}
              {item.registrations.some((reg) => reg.notes) && (
                <div className="mb-4 text-sm text-gray-600">
                  <div className="font-medium mb-1">Notes:</div>
                  {item.registrations
                    .filter((reg) => reg.notes)
                    .map((reg, index) => (
                      <div key={index} className="ml-4">
                        • {reg.roleName}: {reg.notes}
                      </div>
                    ))}
                </div>
              )}

              {/* Special Requirements */}
              {item.registrations.some((reg) => reg.specialRequirements) && (
                <div className="mb-4 text-sm text-gray-600">
                  <div className="font-medium mb-1">Special Requirements:</div>
                  {item.registrations
                    .filter((reg) => reg.specialRequirements)
                    .map((reg, index) => (
                      <div key={index} className="ml-4">
                        • {reg.roleName}: {reg.specialRequirements}
                      </div>
                    ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span>
                    {item.event.type} • {item.event.format}
                  </span>
                </div>
                <button
                  onClick={() => navigate(`/dashboard/event/${item.event.id}`)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium transition-colors"
                >
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
