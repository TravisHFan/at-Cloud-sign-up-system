import { useState, useEffect } from "react";
import EventList from "../components/common/EventList";
import { eventService } from "../services/api";
import type { EventData } from "../types/event";

export default function PassedEvents() {
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch both completed and cancelled events
  const fetchPassedEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get completed events
      const completedEventsResponse = await eventService.getEvents({
        status: "completed",
        limit: 100, // Get a large number to capture all completed events
      });

      // Get cancelled events
      const cancelledEventsResponse = await eventService.getEvents({
        status: "cancelled",
        limit: 100, // Get a large number to capture all cancelled events
      });

      // Combine both arrays
      const combinedEvents = [
        ...(completedEventsResponse.events || []),
        ...(cancelledEventsResponse.events || []),
      ];

      // Sort by date and end time (latest first)
      combinedEvents.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.endTime || a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.endTime || b.time}`);
        return dateTimeB.getTime() - dateTimeA.getTime();
      });

      setAllEvents(combinedEvents);
    } catch (err: any) {
      console.error("Error fetching passed events:", err);
      setError(err.message || "Failed to load passed events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassedEvents();
  }, []);

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
      title="Passed Events"
      canDelete={false}
      emptyStateMessage="No completed or cancelled events found."
    />
  );
}
