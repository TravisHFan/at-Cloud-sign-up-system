import EventList from "../components/common/EventList";
import { useEvents } from "../hooks/useEventsApi";

export default function PassedEvents() {
  const { events, loading, error, refreshEvents } = useEvents({
    status: "completed",
    autoLoad: true,
    pageSize: 20,
  });

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
      type="passed"
      title="Passed Events"
      canDelete={false}
      emptyStateMessage="No completed events found."
    />
  );
}
