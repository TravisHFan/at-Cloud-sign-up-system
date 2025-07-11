import EventList from "../components/common/EventList";
import { mockPassedEventsDynamic } from "../data/mockEventData";

export default function PassedEvents() {
  return (
    <EventList
      events={mockPassedEventsDynamic}
      type="passed"
      title="Passed Events"
      canDelete={false}
      emptyStateMessage="No completed events found."
    />
  );
}
