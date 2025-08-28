import EventList from "../components/common/EventList";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { eventService } from "../services/api";
import type { EventData } from "../types/event";

export default function UpcomingEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const notification = useToastReplacement();

  // Load both upcoming and ongoing events
  const refreshEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both upcoming and ongoing events
      const [upcomingResponse, ongoingResponse] = await Promise.all([
        eventService.getEvents({ status: "upcoming", limit: 100 }),
        eventService.getEvents({ status: "ongoing", limit: 100 }),
      ]);

      // Combine and sort events by date
      const combinedEvents = [
        ...upcomingResponse.events,
        ...ongoingResponse.events,
      ];

      // Sort by date and time (latest first)
      combinedEvents.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.endTime || a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.endTime || b.time}`);
        return dateTimeB.getTime() - dateTimeA.getTime();
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
  }, [notification]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const handleEditEvent = (eventId: string) => {
    navigate(`/dashboard/edit-event/${eventId}`);
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
    />
  );
}
