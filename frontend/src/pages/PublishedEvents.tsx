import EventList from "../components/common/EventList";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { eventService } from "../services/api";
import type { EventData } from "../types/event";

export default function PublishedEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [pagination, setPagination] = useState<{
    currentPage: number;
    totalPages: number;
    totalEvents: number;
    hasNext: boolean;
    hasPrev: boolean;
    pageSize?: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"date" | "title" | "organizer" | "type">(
    "date"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notification = useToastReplacement();

  // Load published events (filter for published AND not completed)
  // We filter out completed events because they're no longer available for registration
  const refreshEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all events and then filter for published ones on the frontend
      // Note: We might want to add a backend filter for this in the future
      const resp = await eventService.getEvents({
        page,
        limit: 10,
        sortBy,
        sortOrder,
      });

      // Filter for published events only (excluding completed/past events)
      // Past events are not useful since they're no longer available for registration
      const publishedEvents = resp.events.filter(
        (event) => event.publish === true && event.status !== "completed"
      );

      setEvents(publishedEvents);

      // Adjust pagination to reflect filtered results
      // Note: This is not perfect since we're filtering client-side
      // but it's a starting point until we add backend filtering
      setPagination({
        currentPage: page,
        totalPages: Math.ceil(publishedEvents.length / 10),
        totalEvents: publishedEvents.length,
        hasNext: page < Math.ceil(publishedEvents.length / 10),
        hasPrev: page > 1,
        pageSize: 10,
      });
    } catch (err: unknown) {
      console.error("Error fetching published events:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load published events: ${message}`);
      notification.error("Error loading published events");
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, notification]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const handleEdit = (eventId: string) => {
    navigate(`/dashboard/event-detail/${eventId}`);
  };

  const handleSortChange = (
    field: "date" | "title" | "organizer" | "type",
    order: "asc" | "desc"
  ) => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1); // Reset to first page when sorting changes
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error loading published events
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={refreshEvents}
                className="bg-red-100 hover:bg-red-200 text-red-800 font-medium py-2 px-4 rounded text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Published Events
        </h1>
        <p className="text-gray-600 mb-4">
          Manage events that are currently published and visible to the public.
          Published events can be discovered and registered for by users through
          public links.
        </p>

        {/* Public Events Link Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-600 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                View Public Events Page
              </h3>
              <p className="text-sm text-blue-700 mb-3">
                See how your published events appear to the public. This is the
                page regular users visit to discover and register for events.
              </p>
              <button
                onClick={() => window.open("/events", "_blank")}
                className="inline-flex items-center space-x-2 text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span>Open Public Events Page</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <EventList
        events={events}
        type="upcoming" // Using upcoming for the styling/behavior
        onEdit={handleEdit}
        canDelete={false} // Probably don't want to allow deletion from this view
        title="" // Remove title since we're adding our own above
        description="" // Remove description since we're adding our own above
        emptyStateMessage="No published events found. Events must be published to appear here."
        pagination={pagination || undefined}
        onPageChange={handlePageChange}
        controlledSort={{
          sortBy,
          sortOrder,
          onChange: handleSortChange,
        }}
      />
    </div>
  );
}
