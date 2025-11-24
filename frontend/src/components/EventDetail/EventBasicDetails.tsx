import { Icon } from "../common";
import { formatEventDateTimeRangeInViewerTZ } from "../../utils/eventStatsUtils";
import type { EventData } from "../../types/event";

interface EventBasicDetailsProps {
  event: EventData;
}

function EventBasicDetails({ event }: EventBasicDetailsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div className="flex items-center text-gray-600 w-full col-span-1 md:col-span-2 lg:col-span-3">
        <Icon name="calendar" className="w-5 h-5 mr-3 flex-shrink-0" />
        <span>
          {formatEventDateTimeRangeInViewerTZ(
            event.date,
            event.time,
            event.endTime,
            event.timeZone,
            event.endDate
          )}
        </span>
        {event.timeZone ? (
          <span className="ml-2 text-xs text-gray-500">
            (shown in your local time)
          </span>
        ) : null}
      </div>
      <div className="flex items-center text-gray-600">
        <Icon name="map-pin" className="w-5 h-5 mr-3" />
        {event.location}
      </div>
      <div className="flex items-center text-gray-600">
        <Icon name="tag" className="w-5 h-5 mr-3" />
        Format: {event.format}
      </div>
      {/* Event Type */}
      <div className="flex items-center text-gray-600">
        <Icon name="check-circle" className="w-5 h-5 mr-3" />
        Type: {event.type || "No Type"}
      </div>
      {/* Pricing */}
      {event.pricing && !event.pricing.isFree && event.pricing.price && (
        <div className="flex items-center text-gray-600">
          <Icon name="tag" className="w-5 h-5 mr-3" />
          <span className="font-semibold text-blue-600">
            Price: ${(event.pricing.price / 100).toFixed(2)}
          </span>
        </div>
      )}
      {event.pricing && event.pricing.isFree && (
        <div className="flex items-center text-gray-600">
          <Icon name="tag" className="w-5 h-5 mr-3" />
          <span className="font-semibold text-green-600">Free Event</span>
        </div>
      )}
    </div>
  );
}

export default EventBasicDetails;
