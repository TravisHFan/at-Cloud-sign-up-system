import { useState, useMemo } from "react";
import { useUserEvents } from "../hooks/useEventsApi";
import { formatEventDate, formatEventTime } from "../utils/eventStatsUtils";
import { Icon } from "../components/common";
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Events</h1>
        <p className="text-gray-600">
          View and manage all your event registrations in one place
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Icon name="calendar" className="w-5 h-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm text-gray-600">Total Events</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Icon name="clock" className="w-5 h-5 text-green-600 mr-2" />
            <div>
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-xl font-bold text-green-900">
                {stats.upcoming}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Icon
              name="check-circle"
              className="w-5 h-5 text-purple-600 mr-2"
            />
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-xl font-bold text-purple-900">
                {stats.passed}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Icon name="x-circle" className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <p className="text-sm text-gray-600">Event Cancelled</p>
              <p className="text-xl font-bold text-red-900">
                {stats.cancelled}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Timing
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Events</option>
              <option value="upcoming">Upcoming Events</option>
              <option value="passed">Passed Events</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredEvents.length} of {events.length} events
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Icon
              name="calendar"
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
            />
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
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.event.title}
                    </h3>
                    {getEventTypeBadge(item.eventStatus)}
                    <div className="flex gap-2">
                      {getStatusBadges(item.registrations, item.isPassedEvent)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon name="calendar" className="w-4 h-4 mr-2" />
                        <span>
                          {formatEventDate(item.event.date)} at{" "}
                          {formatEventTime(item.event.time)}
                          {item.event.endTime &&
                            ` - ${formatEventTime(item.event.endTime)}`}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon name="map-pin" className="w-4 h-4 mr-2" />
                        <span>{item.event.location}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon name="tag" className="w-4 h-4 mr-2" />
                        <span>
                          {item.event.type} • {item.event.format}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon name="user" className="w-4 h-4 mr-2" />
                        <span>
                          Role(s):{" "}
                          <strong>
                            {item.registrations
                              .map((reg) => reg.roleName)
                              .join(", ")}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon name="clock" className="w-4 h-4 mr-2" />
                        <span>
                          First Registered:{" "}
                          {new Date(
                            Math.min(
                              ...item.registrations.map((reg) =>
                                new Date(reg.registrationDate).getTime()
                              )
                            )
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Show combined notes and special requirements */}
                  {item.registrations.some((reg) => reg.notes) && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        <strong>Notes:</strong>
                      </p>
                      {item.registrations
                        .filter((reg) => reg.notes)
                        .map((reg, index) => (
                          <p key={index} className="text-sm text-gray-600 ml-4">
                            • {reg.roleName}: {reg.notes}
                          </p>
                        ))}
                    </div>
                  )}

                  {item.registrations.some(
                    (reg) => reg.specialRequirements
                  ) && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        <strong>Special Requirements:</strong>
                      </p>
                      {item.registrations
                        .filter((reg) => reg.specialRequirements)
                        .map((reg, index) => (
                          <p key={index} className="text-sm text-gray-600 ml-4">
                            • {reg.roleName}: {reg.specialRequirements}
                          </p>
                        ))}
                    </div>
                  )}
                </div>

                <div className="ml-4">
                  <button
                    onClick={() =>
                      navigate(`/dashboard/event/${item.event.id}`)
                    }
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                  >
                    View Event
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
