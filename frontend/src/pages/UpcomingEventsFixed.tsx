import { mockUpcomingEventsDynamic } from "../data/mockEventData";
import EventList from "../components/common/EventList";
import { useState } from "react";
import toast from "react-hot-toast";

export default function UpcomingEvents() {
  const [events] = useState(mockUpcomingEventsDynamic);

  const handleDeleteEvent = async (eventId: string) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Event deleted successfully!");

      // In real app, update the events state
      console.log(`Deleted event ${eventId}`);
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event. Please try again.");
    }
  };

  return (
    <EventList
      events={events}
      type="upcoming"
      title="Upcoming Events"
      onDelete={handleDeleteEvent}
      canDelete={true}
      emptyStateMessage="No upcoming events found. Check back later for new events."
    />
  );
}
