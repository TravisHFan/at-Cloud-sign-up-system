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
  registration: {
    id: string;
    roleId: string;
    roleName: string;
    roleDescription?: string;
    registrationDate: string;
    status: "active" | "cancelled" | "waitlisted" | "attended" | "no_show";
    notes?: string;
    specialRequirements?: string;
    cancelledDate?: string;
  };
  isPassedEvent: boolean;
  eventStatus: "upcoming" | "passed";
}

interface MyEventsStats {
  total: number;
  upcoming: number;
  passed: number;
  active: number;
  cancelled: number;
}

export default function MyEvents() {
  const navigate = useNavigate();
  const { events: rawEvents, loading, error, refreshEvents } = useUserEvents();
  const [filter, setFilter] = useState<"all" | "upcoming" | "passed">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "cancelled"
  >("all");

  // Parse the events data
  const { events, stats }: { events: MyEventItem[]; stats: MyEventsStats } =
    useMemo(() => {
      if (!rawEvents || !Array.isArray(rawEvents)) {
        return {
          events: [],
          stats: { total: 0, upcoming: 0, passed: 0, active: 0, cancelled: 0 },
        };
      }
      return {
        events: rawEvents as MyEventItem[],
        stats: rawEvents[0]?.stats || {
          total: 0,
          upcoming: 0,
          passed: 0,
          active: 0,
          cancelled: 0,
        },
      };
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

    // Filter by registration status
    if (statusFilter === "active") {
      filtered = filtered.filter(
        (item) => item.registration.status === "active"
      );
    } else if (statusFilter === "cancelled") {
      filtered = filtered.filter(
        (item) => item.registration.status === "cancelled"
      );
    }

    return filtered;
  }, [events, filter, statusFilter]);

  const getStatusBadge = (status: string, isPassedEvent: boolean) => {
    if (status === "cancelled") {
      return <Badge variant="error">Cancelled</Badge>;
    }
    if (isPassedEvent) {
      if (status === "attended") {
        return <Badge variant="success">Attended</Badge>;
      }
      if (status === "no_show") {
        return <Badge variant="error">No Show</Badge>;
      }
      return <Badge variant="neutral">Completed</Badge>;
    }
    if (status === "active") {
      return <Badge variant="success">Registered</Badge>;
    }
    if (status === "waitlisted") {
      return <Badge variant="warning">Waitlisted</Badge>;
    }
    return <Badge variant="neutral">{status}</Badge>;
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <Icon name="user" className="w-5 h-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-xl font-bold text-blue-900">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Icon name="x-circle" className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <p className="text-sm text-gray-600">Cancelled</p>
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

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Registration Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Registrations</option>
              <option value="cancelled">Cancelled Registrations</option>
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
              key={`${item.event.id}-${item.registration.id}`}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.event.title}
                    </h3>
                    {getEventTypeBadge(item.eventStatus)}
                    {getStatusBadge(
                      item.registration.status,
                      item.isPassedEvent
                    )}
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
                          Role: <strong>{item.registration.roleName}</strong>
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Icon name="clock" className="w-4 h-4 mr-2" />
                        <span>
                          Registered:{" "}
                          {new Date(
                            item.registration.registrationDate
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      {item.registration.cancelledDate && (
                        <div className="flex items-center text-sm text-red-600">
                          <Icon name="x-circle" className="w-4 h-4 mr-2" />
                          <span>
                            Cancelled:{" "}
                            {new Date(
                              item.registration.cancelledDate
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {item.registration.notes && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        <strong>Notes:</strong> {item.registration.notes}
                      </p>
                    </div>
                  )}

                  {item.registration.specialRequirements && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        <strong>Special Requirements:</strong>{" "}
                        {item.registration.specialRequirements}
                      </p>
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
