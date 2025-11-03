import FlyerCarousel from "../events/FlyerCarousel";
import type { EventData } from "../../types/event";

interface FlyerDisplayProps {
  event: EventData;
}

function FlyerDisplay({ event }: FlyerDisplayProps) {
  if (!event.flyerUrl && !event.secondaryFlyerUrl) {
    return null;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Event Flyer
        {event.flyerUrl && event.secondaryFlyerUrl ? "s" : ""}
      </h3>
      <FlyerCarousel
        flyerUrl={event.flyerUrl}
        secondaryFlyerUrl={event.secondaryFlyerUrl}
        className="max-w-2xl"
      />
    </div>
  );
}

export default FlyerDisplay;
