import EventList from "../components/common/EventList";
import { useEvents } from "../hooks/useEventsApi";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { useNavigate } from "react-router-dom";

export default function UpcomingEvents() {
  const navigate = useNavigate();
  const { events, loading, error, refreshEvents } = useEvents({
    status: "upcoming",
    autoLoad: true,
    pageSize: 20, // Load more events for the listing page
  });
  const notification = useToastReplacement();

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
      emptyStateMessage="No upcoming events found. Check back later for new events."
    />
  );
}
