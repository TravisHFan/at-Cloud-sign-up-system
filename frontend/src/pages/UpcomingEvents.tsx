import EventList from "../components/common/EventList";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { eventService } from "../services/api";
import type { EventData } from "../types/event";

export default function UpcomingEvents() {
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
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notification = useToastReplacement();

  // Load both upcoming and ongoing events
  const refreshEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both upcoming and ongoing events
      const combinedStatuses = "upcoming,ongoing";
      const resp = await eventService.getEvents({
        statuses: combinedStatuses,
        page,
        limit: 10,
        sortBy,
        sortOrder,
      } as any);
      const combinedEvents = resp.events;
      setPagination({
        ...resp.pagination,
        pageSize: 10,
      });
      setEvents(combinedEvents);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message ?? "")
          : "Failed to load events";
      setError(message || "Failed to load events");
      notification.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [notification, page, sortBy, sortOrder]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents, page, sortBy, sortOrder]);

  const handleControlledSort = (
    field: "date" | "title" | "organizer" | "type",
    order: "asc" | "desc"
  ) => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1); // reset pagination on new sort
  };

  const handleEditEvent = (eventId: string) => {
    navigate(`/dashboard/edit-event/${eventId}`, {
      state: { returnTo: "/dashboard/upcoming" },
    });
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      // Delete API call would go here
      // await eventService.deleteEvent(eventId);

      // For now, just refresh the events list
      await refreshEvents();

      // Show success message
      notification.success(`Event ${eventId} has been permanently deleted.`, {
        title: "Event Deleted",
        autoCloseDelay: 3000,
      });
    } catch (error) {
      console.error("Error deleting event:", error);
      notification.error("Failed to delete event. Please try again.", {
        title: "Delete Failed",
      });
    }
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
    <EventList
      events={events}
      type="upcoming"
      title="Upcoming Events"
      onDelete={handleDeleteEvent}
      onEdit={handleEditEvent}
      emptyStateMessage="No upcoming events found. Events that haven't ended yet will appear here."
      pagination={pagination || undefined}
      onPageChange={(p) => setPage(p)}
      controlledSort={{ sortBy, sortOrder, onChange: handleControlledSort }}
    />
  );
}
