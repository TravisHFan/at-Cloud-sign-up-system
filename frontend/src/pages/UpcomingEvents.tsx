import EventList from "../components/common/EventList";
import { mockUpcomingEventsDynamic } from "../data/mockEventData";

export default function UpcomingEvents() {
  const handleDeleteEvent = async (eventId: string) => {
    try {
      // Delete API call would go here
      console.log("Deleting event:", eventId);

      // Show success message
      // toast.success("Event has been permanently deleted.");

      // Could trigger a refresh of events here
    } catch (error) {
      console.error("Error deleting event:", error);
      // toast.error("Failed to delete event. Please try again.");
    }
  };

  return (
    <EventList
      events={mockUpcomingEventsDynamic}
      type="upcoming"
      title="Upcoming Events"
      onDelete={handleDeleteEvent}
      emptyStateMessage="No upcoming events found. Check back later for new events."
    />
  );
}
