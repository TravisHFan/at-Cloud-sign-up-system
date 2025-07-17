import EventList from "../components/common/EventList";
import { useEvents } from "../hooks/useEventsApi";
import toast from "react-hot-toast";

export default function UpcomingEvents() {
  const { events, loading, error, refreshEvents } = useEvents({
    status: "upcoming",
    autoLoad: true,
    pageSize: 20, // Load more events for the listing page
  });

  const handleDeleteEvent = async (eventId: string) => {
    try {
      // Delete API call would go here

      // For now, just refresh the events list
      await refreshEvents();

      // Show success message
      toast.success("Event has been permanently deleted.");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event. Please try again.");
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
      emptyStateMessage="No upcoming events found. Check back later for new events."
    />
  );
}
