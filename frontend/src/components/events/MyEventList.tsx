import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MyEventStatsCards from "./MyEventStatsCards";
import MyEventListItem from "./MyEventListItem";
import { getCardClass } from "../../utils/uiUtils";

interface MyEventRegistration {
  id: string;
  roleId: string;
  roleName: string;
  roleDescription?: string;
  registrationDate: string;
  status: "active" | "waitlisted" | "attended" | "no_show";
  notes?: string;
  specialRequirements?: string;
}

interface MyEventItemData {
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
  registrations: MyEventRegistration[];
  isPassedEvent: boolean;
  eventStatus: "upcoming" | "passed";
}

interface MyEventListProps {
  events: MyEventItemData[];
  stats: {
    total: number;
    upcoming: number;
    passed: number;
    cancelled?: number;
  };
  title: string;
}

export default function MyEventList({
  events,
  stats,
  title,
}: MyEventListProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "upcoming" | "passed">("all");

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600 mt-1">
          View and manage all your event registrations in one place
        </p>
      </div>

      {/* Event Statistics */}
      <MyEventStatsCards stats={stats} />

      {/* Search and Filter Controls */}
      <div className={getCardClass(false, "medium")}>
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
          <div className={getCardClass(false, "large", "text-center")}>
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
            <MyEventListItem key={item.event.id} item={item} />
          ))
        )}
      </div>
    </div>
  );
}
