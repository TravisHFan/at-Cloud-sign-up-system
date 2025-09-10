import { useState, useEffect, useCallback } from "react";
import EventList from "../components/common/EventList";
import { eventService } from "../services/api";
import type { EventData } from "../types/event";

export default function PassedEvents() {
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch both completed and cancelled events in a single multi-status call (paginated)
  const fetchPassedEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Backend supports multi-status queries via 'statuses' (comma-delimited)
      const response = await eventService.getEvents({
        statuses: "completed,cancelled",
        page,
        limit: 10,
        sortBy,
        sortOrder,
      });

      const events = response.events || [];

      setAllEvents(events);
      setPagination({
        ...response.pagination,
        pageSize: 10,
      });
    } catch (err: unknown) {
      console.error("Error fetching past events:", err);
      const msg =
        (err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : undefined) || "Failed to load past events";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder]);

  useEffect(() => {
    fetchPassedEvents();
  }, [fetchPassedEvents, sortBy, sortOrder]);

  const handleControlledSort = (
    field: "date" | "title" | "organizer" | "type",
    order: "asc" | "desc"
  ) => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
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
          onClick={fetchPassedEvents}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <EventList
      events={allEvents}
      type="passed"
      title="Past Events"
      canDelete={false}
      emptyStateMessage="No completed or cancelled events found."
      pagination={pagination || undefined}
      onPageChange={(p) => setPage(p)}
      controlledSort={{ sortBy, sortOrder, onChange: handleControlledSort }}
    />
  );
}
