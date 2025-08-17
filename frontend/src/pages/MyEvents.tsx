import { useMemo } from "react";
import { useUserEvents } from "../hooks/useEventsApi";
import MyEventList from "../components/events/MyEventList";
import type { MyEventItemData } from "../types/myEvents";

export default function MyEvents() {
  const {
    events: rawEvents,
    stats,
    loading,
    error,
    refreshEvents,
  } = useUserEvents();

  // Parse and group the events data by event ID
  const events: MyEventItemData[] = useMemo(() => {
    if (!rawEvents || !Array.isArray(rawEvents)) {
      return [];
    }

    // Group registrations by event ID
    const eventGroups = new Map<string, MyEventItemData>();

    rawEvents.forEach(
      (item: {
        event: {
          id: string;
          title: string;
          date: string;
          endDate?: string;
          time: string;
          endTime?: string;
          location: string;
          format: string;
          status: string;
          type: string;
          organizer: string;
          timeZone?: string;
          createdAt: string;
        };
        registration: {
          id: string;
          roleId: string;
          roleName: string;
          roleDescription?: string;
          registrationDate: string;
          status: "active" | "waitlisted" | "attended" | "no_show";
          notes?: string;
          specialRequirements?: string;
        };
        isPassedEvent: boolean;
        eventStatus: "upcoming" | "passed";
      }) => {
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
      }
    );

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

  return <MyEventList events={events} stats={stats} title="My Events" />;
}
