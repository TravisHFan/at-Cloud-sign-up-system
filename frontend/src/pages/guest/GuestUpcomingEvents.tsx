import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { eventService } from "../../services/api";
import type { EventData } from "../../types/event";
import { GuestEventList } from "../../components/guest";

export default function GuestUpcomingEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  // Guest-specific navigation handlers
  const handleGuestSignUp = (eventId: string) => {
    // Navigate to guest registration page
    navigate(`/guest-register/${eventId}`);
  };

  const handleGuestViewDetails = (eventId: string) => {
    // For guests, "View Details" should also lead to registration
    navigate(`/guest-register/${eventId}`);
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
    <GuestEventList
      events={events}
      type="upcoming"
      title="Upcoming Events"
      emptyStateMessage="No upcoming events found. New events will appear here when they're available."
      onSignUp={handleGuestSignUp}
      onViewDetails={handleGuestViewDetails}
    />
  );
}
