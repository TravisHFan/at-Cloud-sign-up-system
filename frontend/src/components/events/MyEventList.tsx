import { useNavigate } from "react-router-dom";
import { useMyEventList } from "../../hooks/useMyEventList";
import MyEventStatsCards from "./MyEventStatsCards";
import MyEventListItem from "./MyEventListItem";
import EventCalendar from "./EventCalendar";
import { getCardClass, getSortButtonClass } from "../../utils/uiUtils";
import type { MyEventItemData, MyEventStats } from "../../types/myEvents";

interface MyEventListProps {
  events: MyEventItemData[];
  stats: MyEventStats;
  title: string;
}

export default function MyEventList({
  events,
  stats,
  title,
}: MyEventListProps) {
  const navigate = useNavigate();
  const {
    events: filteredEvents,
    allEvents,
    searchTerm,
    setSearchTerm,
    filter,
    setFilter,
    sortBy,
    sortOrder,
    handleSort,
    handleViewDetails,
  } = useMyEventList({ events });

  // Get sort icon
  const getSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? "↑" : "↓";
  };

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

      {/* Event Calendar */}
      <EventCalendar
        events={events}
        type="my-events"
        onEventClick={(eventId) => navigate(`/dashboard/event/${eventId}`)}
      />

      {/* Search and Filter Controls */}
      <div className={getCardClass(false, "medium")}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              id="event-search"
              name="search"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => handleSort("date")}
              className={getSortButtonClass(sortBy === "date")}
            >
              Date {getSortIcon("date")}
            </button>
            <button
              onClick={() => handleSort("title")}
              className={getSortButtonClass(sortBy === "title")}
            >
              Title {getSortIcon("title")}
            </button>
            <button
              onClick={() => handleSort("organizer")}
              className={getSortButtonClass(sortBy === "organizer")}
            >
              Organizer {getSortIcon("organizer")}
            </button>
          </div>
        </div>

        {/* Filter Dropdown - moved below */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4">
          <div className="relative">
            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as "all" | "upcoming" | "passed")
              }
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
