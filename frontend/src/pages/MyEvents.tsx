import { useMemo, useState } from "react";
import { useUserEvents } from "../hooks/useEventsApi";
import MyEventList from "../components/events/MyEventList";
import LoadingSpinner from "../components/common/LoadingSpinner";
import type {
  MyEventItemData,
  MyEventRegistrationItem,
} from "../types/myEvents";

export default function MyEvents() {
  const [page, setPage] = useState(1);
  const {
    events: rawEvents,
    stats,
    loading,
    error,
    refreshEvents,
    pagination,
  } = useUserEvents(page, 10);

  // Parse and group the events data by event ID
  const events: MyEventItemData[] = useMemo(() => {
    if (!rawEvents || !Array.isArray(rawEvents)) {
      return [];
    }

    // Group registrations by event ID
    const eventGroups = new Map<string, MyEventItemData>();

    rawEvents.forEach((item: MyEventRegistrationItem) => {
      const eventId = item.event.id;

      if (eventGroups.has(eventId)) {
        // Add registration to existing event
        const existingEvent = eventGroups.get(eventId)!;
        existingEvent.registrations.push(item.registration);
      } else {
        // Create new event with first registration
        eventGroups.set(eventId, {
          event: item.event,
          registrations: [item.registration],
          isPassedEvent: item.isPassedEvent,
          eventStatus: item.eventStatus,
        });
      }
    });

    return Array.from(eventGroups.values()).sort((a, b) => {
      // Sort by effective end datetime (use endDate if present)
      const endDateA = a.event.endDate || a.event.date;
      const endDateB = b.event.endDate || b.event.date;
      const dateTimeA = new Date(
        `${endDateA}T${a.event.endTime || a.event.time}`
      );
      const dateTimeB = new Date(
        `${endDateB}T${b.event.endTime || b.event.time}`
      );
      return dateTimeB.getTime() - dateTimeA.getTime();
    });
  }, [rawEvents]);

  if (loading) {
    return <LoadingSpinner size="lg" />;
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
    <MyEventList
      events={events}
      stats={stats}
      title="My Events"
      pagination={pagination}
      onPageChange={(p) => setPage(p)}
    />
  );
}
