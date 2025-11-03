import Multiline from "../common/Multiline";
import type { EventData } from "../../types/event";

interface EventHostAndPurposeProps {
  event: EventData;
}

function EventHostAndPurpose({ event }: EventHostAndPurposeProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Hosted by</h3>
        <div className="flex items-center text-gray-700">
          <img
            src="/Cloud-removebg.png"
            alt="@Cloud Logo"
            className="h-6 w-auto mr-2 object-contain"
          />
          {event.hostedBy || "@Cloud Marketplace Ministry"}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Purpose</h3>
        {event.purpose ? (
          // Preserve user-authored line breaks similarly to public event page
          <div className="text-gray-700" data-testid="event-detail-purpose">
            <Multiline text={event.purpose} />
          </div>
        ) : (
          <p className="text-gray-500">No purpose provided.</p>
        )}
      </div>
    </div>
  );
}

export default EventHostAndPurpose;
