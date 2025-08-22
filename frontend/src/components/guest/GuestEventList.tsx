import { useGuestEventList } from "../../hooks/useGuestEventList.ts";
import EventStatsCards from "../events/EventStatsCards";
import EventListItem from "../events/EventListItem";
import EventCalendar from "../events/EventCalendar";
import { getSortButtonClass, getCardClass } from "../../utils/uiUtils";
import { Link, useLocation } from "react-router-dom";
import type { EventData } from "../../types/event";

interface GuestEventListProps {
  events: EventData[];
  type: "upcoming" | "passed";
  title: string;
  emptyStateMessage?: string;
  onSignUp: (eventId: string) => void;
  onViewDetails: (eventId: string) => void;
}

export default function GuestEventList({
  events,
  type,
  title,
  emptyStateMessage = `No ${type} events found.`,
  onSignUp,
  onViewDetails,
}: GuestEventListProps) {
  const location = useLocation();
  const {
    events: filteredEvents,
    stats,
    searchTerm,
    setSearchTerm,
    sortBy,
    sortOrder,
    handleSort,
  } = useGuestEventList({ events, type, onSignUp, onViewDetails });

  // If we are on the guest "My Events" route, show a simple prompt to encourage sign up
  const isGuestMyEvents = location.pathname.includes(
    "/guest-dashboard/my-events"
  );
  if (isGuestMyEvents) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 text-3xl">
            ✨
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            My Events for Guests
          </h1>
          <p className="text-gray-600">
            We suggest guests sign up for a free account to access My Events
            management and records.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-white font-medium shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Sign up to unlock My Events
          </Link>
          <Link
            to="/guest-dashboard/upcoming"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-5 py-3 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Browse upcoming events
          </Link>
        </div>
      </div>
    );
  }

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
          {type === "upcoming"
            ? "Explore upcoming events and join as a guest"
            : "Browse completed and cancelled events"}
        </p>
      </div>

      {/* Event Statistics */}
      <EventStatsCards stats={stats} type={type} />

      {/* Event Calendar */}
      <EventCalendar
        events={events}
        type="upcoming"
        onEventClick={(eventId) => onViewDetails(eventId)}
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
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className={getCardClass(false, "medium")}>
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-4">📅</div>
              <p className="text-gray-500 text-lg mb-2">{emptyStateMessage}</p>
              <p className="text-gray-400 text-sm">
                Check back later for new events, or sign up to get notified!
              </p>
            </div>
          </div>
        ) : (
          filteredEvents.map((event: EventData) => (
            <EventListItem
              key={event.id}
              event={event}
              type={type}
              onSignUp={onSignUp}
              onViewDetails={onViewDetails}
              isGuest={true}
            />
          ))
        )}
      </div>
    </div>
  );
}
