import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/common";
import apiClient from "../services/api";
import type { PublicEventListItem } from "../types/publicEvent";
import { EVENT_TYPES } from "../config/eventConstants";
import { formatEventDateTimeRangeInViewerTZ } from "../utils/eventStatsUtils";

export default function PublicEventsList() {
  const [events, setEvents] = useState<PublicEventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  // Debounce timer ref (no re-render needed when it changes)
  const debounceRef = useRef<number | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });

  const loadEvents = useCallback(
    async (
      currentPage = 1,
      currentSearch = search,
      currentType = typeFilter,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiClient.getPublicEvents({
          page: currentPage,
          limit: 12,
          ...(currentSearch && { search: currentSearch }),
          ...(currentType && { type: currentType }),
        });
        setEvents(result.events);
        setPagination(result.pagination);
      } catch (err) {
        const e = err as Error;
        setError(e.message || "Failed to load events");
      } finally {
        setLoading(false);
      }
    },
    [search, typeFilter],
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Live search debounce (search and typeFilter changes)
  useEffect(() => {
    // Reset to first page when search or filter changes
    setPage(1);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const id = window.setTimeout(() => {
      loadEvents(1, search, typeFilter);
    }, 300); // 300ms debounce
    debounceRef.current = id;
    return () => window.clearTimeout(id);
  }, [search, typeFilter, loadEvents]);

  // Pagination handler (fetch specific page with current filters)
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (
        newPage < 1 ||
        newPage === page ||
        (pagination.totalPages && newPage > pagination.totalPages)
      ) {
        return;
      }
      setPage(newPage);
      loadEvents(newPage, search, typeFilter);
    },
    [page, pagination.totalPages, loadEvents, search, typeFilter],
  );

  if (loading && events.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6" data-testid="events-loading">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-3"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6" data-testid="events-error">
        <div className="text-center py-12">
          <Icon
            name="x-circle"
            className="w-12 h-12 text-red-400 mx-auto mb-4"
          />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to Load Events
          </h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadEvents(page, search, typeFilter)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Public Events
          </h1>
          <p className="text-gray-600 mb-4">
            Discover and register for upcoming events open to the public
          </p>
          <div
            className="text-base text-gray-700 flex items-center"
            data-testid="public-events-hosted-by"
          >
            <img
              src="/Cloud-removebg.png"
              alt="@Cloud Logo"
              className="h-6 w-auto mr-2 object-contain"
              loading="lazy"
            />
            <span>
              Hosted by{" "}
              <span className="text-gray-900 font-normal">
                @Cloud Marketplace Ministry
              </span>
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Count */}
          {pagination.total > 0 && (
            <div className="text-sm text-gray-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total} events
            </div>
          )}
        </div>

        {/* Events Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {events.length === 0 && !loading ? (
            <div className="text-center py-12">
              <Icon
                name="calendar"
                className="w-12 h-12 text-gray-400 mx-auto mb-4"
              />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No events found
              </h3>
              <p className="text-gray-600">
                {search || typeFilter
                  ? "Try adjusting your search criteria"
                  : "No public events are currently available"}
              </p>
            </div>
          ) : (
            // Wider cards: two columns on large screens (occupy ~1/2 width)
            <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
              {events.map((event) => {
                try {
                  return (
                    <EventCard key={event.title + event.start} event={event} />
                  );
                } catch (error) {
                  console.error(
                    "Error rendering EventCard:",
                    error,
                    "Event data:",
                    event,
                  );
                  return (
                    <div
                      key={event.title + event.start}
                      className="bg-red-50 border border-red-200 rounded-lg p-4"
                    >
                      <h3 className="text-red-800 font-medium">
                        Error displaying event
                      </h3>
                      <p className="text-red-600 text-sm">
                        {event.title || "Unknown event"}
                      </p>
                      <p className="text-red-500 text-xs mt-2">
                        Check console for details
                      </p>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-center items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>

              {[...Array(pagination.totalPages)].map((_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === page;

                // Show first, last, current, and adjacent pages
                if (
                  pageNum === 1 ||
                  pageNum === pagination.totalPages ||
                  Math.abs(pageNum - page) <= 1
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-2 text-sm border rounded-md ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }

                // Show ellipsis for gaps
                if (pageNum === page - 2 || pageNum === page + 2) {
                  return (
                    <span
                      key={pageNum}
                      className="px-2 py-2 text-sm text-gray-400"
                    >
                      ...
                    </span>
                  );
                }

                return null;
              })}

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === pagination.totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Get event type color classes based on calendar legend colors
function getEventTypeColorClasses(eventType: string | undefined): string {
  // Handle undefined or null eventType
  if (!eventType) {
    return "bg-gray-100 text-gray-800";
  }

  // Color mapping based on event type - synchronized with EventCalendar component
  switch (eventType) {
    case "Conference":
      return "bg-purple-100 text-purple-800";
    case "Webinar":
      return "bg-sky-100 text-sky-800";
    case "Effective Communication Workshop":
    case "Workshop":
      // Match "Effective Communication Workshops" program orange colors
      return "bg-orange-100 text-orange-800";
    case "Mentor Circle":
      // Match "EMBA Mentor Circles" program blue colors
      return "bg-blue-100 text-blue-800";
    case "NextGen":
      // Match "NextGen" program olive/lime colors
      return "bg-lime-100 text-lime-800";
    default:
      // Fallback to purple for unknown types
      return "bg-purple-100 text-purple-800";
  }
}

// Get shorter display name for event type labels
function getEventTypeDisplayName(
  eventType: string | undefined,
  title?: string,
): string {
  // If missing, heuristically infer from title keywords
  if (!eventType) {
    if (title) {
      const t = title.toLowerCase();
      if (t.includes("mentor circle")) return "Mentor Circle";
      if (t.includes("webinar")) return "Webinar";
      if (t.includes("conference")) return "Conference";
      if (t.includes("workshop")) return "ECW Series";
    }
    return "Event";
  }
  switch (eventType) {
    case "Effective Communication Workshop":
      return "ECW Series";
    case "Conference":
      return "Conference";
    case "Webinar":
      return "Webinar";
    case "Mentor Circle":
      return "Mentor Circle";
    default:
      return eventType.length > 20
        ? eventType.substring(0, 17) + "..."
        : eventType;
  }
}

function EventCard({ event }: { event: PublicEventListItem }) {
  // Use the same approach as PublicEvent detail page - raw date/time components with proper timezone handling
  const dateRange = formatEventDateTimeRangeInViewerTZ(
    event.date,
    event.time,
    event.endTime,
    event.timeZone,
    event.endDate,
  );

  // Simple date parsing for upcoming status (the ISO string should now be correct)
  const startDate = new Date(event.start);
  const isUpcoming = startDate > new Date();
  const hasAvailableSpots = event.capacityRemaining > 0;

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
      {/* Event Type & Status */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColorClasses(
            event.type,
          )}`}
        >
          {getEventTypeDisplayName(event.type, event.title)}
        </span>
        {!isUpcoming && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            Past Event
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
        {event.title}
      </h3>

      {/* Date & Local Time (explicit local timezone rendering) */}
      <div className="flex items-center text-sm text-gray-600 mb-3">
        <Icon name="calendar" className="w-4 h-4 mr-2" />
        <span className="leading-snug" title={dateRange}>
          {dateRange}
        </span>
      </div>

      {/* Capacity Summary */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {event.rolesOpen} role{event.rolesOpen !== 1 ? "s" : ""} available
          </span>
          <span
            className={`font-medium ${
              hasAvailableSpots ? "text-green-600" : "text-red-600"
            }`}
          >
            {event.capacityRemaining} spot
            {event.capacityRemaining !== 1 ? "s" : ""} remaining
          </span>
        </div>
      </div>

      {/* Action Button */}
      <Link
        to={`/p/${event.slug}`}
        className={`w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          isUpcoming && hasAvailableSpots
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-300 text-gray-600 cursor-not-allowed"
        }`}
      >
        {isUpcoming
          ? hasAvailableSpots
            ? "View & Register"
            : "View (Full)"
          : "View Details"}
      </Link>
    </div>
  );
}
