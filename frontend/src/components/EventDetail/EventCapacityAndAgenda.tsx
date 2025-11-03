import { Icon } from "../common";
import type { EventData } from "../../types/event";

interface EventCapacityAndAgendaProps {
  event: EventData;
}

function EventCapacityAndAgenda({ event }: EventCapacityAndAgendaProps) {
  return (
    <div className="space-y-4">
      {/* Event Capacity */}
      {event.totalSlots && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Event Capacity
          </h3>
          <div className="flex items-center text-gray-700">
            <Icon name="user" className="w-5 h-5 mr-2" />
            <span>
              {event.totalSlots} total slots available
              {event.signedUp !== undefined && (
                <span className="text-gray-500 ml-2">
                  ({event.signedUp} currently signed up)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Event Agenda and Schedule */}
      {event.agenda && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Event Agenda and Schedule
          </h3>
          <div className="text-gray-700 whitespace-pre-line">
            {event.agenda}
          </div>
        </div>
      )}
    </div>
  );
}

export default EventCapacityAndAgenda;
