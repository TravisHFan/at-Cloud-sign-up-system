import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/common";
import apiClient from "../services/api";
import type { PublicEventData } from "../types/publicEvent";

export default function PublicEventsList() {
  const [events, setEvents] = useState<PublicEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });

  const loadEvents = async (
    currentPage = 1,
    currentSearch = search,
    currentType = typeFilter
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
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadEvents(1, search, typeFilter);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadEvents(newPage, search, typeFilter);
  };

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
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Public Events</h1>
        <p className="text-gray-600">
          Discover and register for upcoming events open to the public
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6">
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row gap-4"
        >
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="Workshop">Workshop</option>
              <option value="Meeting">Meeting</option>
              <option value="Event">Event</option>
              <option value="Mentorship">Mentorship</option>
              <option value="Training">Training</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icon name="plus" className="w-4 h-4" />
            Search
          </button>
        </form>
      </div>

      {/* Results Count */}
      {pagination.total > 0 && (
        <div className="mb-4 text-sm text-gray-600">
          Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} events
        </div>
      )}

      {/* Events Grid */}
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {events.map((event) => (
            <EventCard key={event.title + event.start} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
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
                <span key={pageNum} className="px-2 py-2 text-sm text-gray-400">
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
      )}
    </div>
  );
}

function EventCard({ event }: { event: PublicEventData }) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const isUpcoming = startDate > new Date();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const totalCapacity = event.roles.reduce(
    (sum, role) => sum + (role.capacityRemaining || 0),
    0
  );

  const hasAvailableSpots = totalCapacity > 0;

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
      {/* Event Type & Status */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          Event
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

      {/* Date & Time */}
      <div className="flex items-center text-sm text-gray-600 mb-2">
        <Icon name="calendar" className="w-4 h-4 mr-2" />
        <span>
          {formatDate(startDate)}
          {startDate.toDateString() !== endDate.toDateString() &&
            ` - ${formatDate(endDate)}`}
        </span>
      </div>

      <div className="flex items-center text-sm text-gray-600 mb-3">
        <Icon name="clock" className="w-4 h-4 mr-2" />
        <span>
          {formatTime(startDate)} - {formatTime(endDate)}
        </span>
      </div>

      {/* Location */}
      {event.location && (
        <div className="flex items-center text-sm text-gray-600 mb-3">
          <Icon name="map-pin" className="w-4 h-4 mr-2" />
          <span className="line-clamp-1">{event.location}</span>
        </div>
      )}

      {/* Description */}
      {event.purpose && (
        <p className="text-sm text-gray-700 mb-4 line-clamp-2">
          {event.purpose.replace(/<[^>]*>/g, "")} {/* Strip HTML */}
        </p>
      )}

      {/* Roles & Capacity */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1">Available Roles:</div>
        <div className="flex flex-wrap gap-1">
          {event.roles.map((role) => (
            <span
              key={role.roleId}
              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                (role.capacityRemaining || 0) > 0
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {role.name}
              {role.capacityRemaining !== undefined && (
                <span className="ml-1">({role.capacityRemaining})</span>
              )}
            </span>
          ))}
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
