import { useEventList } from "../../hooks/useEventList";
import EventStatsCards from "../events/EventStatsCards";
import EventListItem from "../events/EventListItem";
import EventCalendar from "../events/EventCalendar";
import { getSortButtonClass, getCardClass } from "../../utils/uiUtils";
import type { EventData } from "../../types/event";

interface EventListProps {
  events: EventData[];
  type: "upcoming" | "passed";
  onDelete?: (eventId: string) => Promise<void>;
  onEdit?: (eventId: string) => void;
  canDelete?: boolean;
  title: string;
  emptyStateMessage?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalEvents: number;
    hasNext: boolean;
    hasPrev: boolean;
    pageSize?: number;
  };
  onPageChange?: (page: number) => void;
  controlledSort?: {
    sortBy: "date" | "title" | "organizer" | "type";
    sortOrder: "asc" | "desc";
    onChange: (
      field: "date" | "title" | "organizer" | "type",
      order: "asc" | "desc"
    ) => void;
  };
}

export default function EventList({
  events,
  type,
  onDelete,
  onEdit,
  canDelete = false,
  title,
  emptyStateMessage = `No ${type} events found.`,
  pagination,
  onPageChange,
  controlledSort,
}: EventListProps) {
  const {
    events: filteredEvents,
    stats,
    searchTerm,
    setSearchTerm,
    sortBy,
    sortOrder,
    handleSort,
    handleSignUp,
    handleViewDetails,
  } = useEventList({
    events,
    type,
    controlledSort: controlledSort && {
      sortBy: controlledSort.sortBy,
      sortOrder: controlledSort.sortOrder,
      disableLocalSorting: true,
      onSortChange: controlledSort.onChange,
    },
  });

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
            ? "View and sign up for upcoming events"
            : "Browse completed and cancelled events"}
        </p>
      </div>

      {/* Event Statistics */}
      <EventStatsCards stats={stats} type={type} />

      {/* Event Calendar */}
      <EventCalendar
        events={events}
        type="upcoming"
        onEventClick={(eventId) => handleViewDetails(eventId)}
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
            <button
              onClick={() => handleSort("type")}
              className={getSortButtonClass(sortBy === "type")}
            >
              Type {getSortIcon("type")}
            </button>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-gray-600 mt-4">
          {pagination
            ? (() => {
                const pageSize = pagination.pageSize || 10;
                const shown = Math.min(
                  pageSize,
                  pagination.totalEvents -
                    (pagination.currentPage - 1) * pageSize
                );
                return `Showing ${shown} of ${pagination.totalEvents} events`;
              })()
            : `Showing ${filteredEvents.length} of ${events.length} events`}
        </p>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center gap-2 mt-2">
            <button
              disabled={!pagination.hasPrev}
              onClick={() =>
                onPageChange &&
                pagination.hasPrev &&
                onPageChange(pagination.currentPage - 1)
              }
              className={`px-3 py-1 rounded border text-sm ${
                pagination.hasPrev
                  ? "bg-white hover:bg-gray-50"
                  : "bg-gray-100 cursor-not-allowed"
              }`}
            >
              Prev
            </button>
            <span className="text-xs text-gray-600">
              Page {pagination.currentPage} / {pagination.totalPages}
            </span>
            <button
              disabled={!pagination.hasNext}
              onClick={() =>
                onPageChange &&
                pagination.hasNext &&
                onPageChange(pagination.currentPage + 1)
              }
              className={`px-3 py-1 rounded border text-sm ${
                pagination.hasNext
                  ? "bg-white hover:bg-gray-50"
                  : "bg-gray-100 cursor-not-allowed"
              }`}
            >
              Next
            </button>
          </div>
        )}
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
            <p className="text-gray-600">{emptyStateMessage}</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <EventListItem
              key={event.id}
              event={event}
              type={type}
              onSignUp={handleSignUp}
              onViewDetails={handleViewDetails}
              onDelete={onDelete}
              onEdit={onEdit}
              canDelete={canDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
