import { mockPassedEventsDynamic } from "../data/mockEventData";
import EventList from "../components/common/EventList";
import { useState } from "react";

export default function PassedEvents() {
  const [events] = useState(mockPassedEventsDynamic);

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
