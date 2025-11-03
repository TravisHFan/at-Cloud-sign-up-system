import Icon from "../common/Icon";
import { usePublishReadiness } from "../../hooks/usePublishReadiness";
import type { EventData } from "../../types/event";

function PublishReadinessInline({ event }: { event: EventData }) {
  const { missingLabels, isReady } = usePublishReadiness(event);
  const hasPublicRole = event.roles.some((r) => r.openToPublic);
  if (!hasPublicRole) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
        <Icon name="x-circle" className="w-4 h-4" />
        <span>Add at least one "Open to Public" role below to publish</span>
      </div>
    );
  }
  if (!isReady) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
        <Icon name="x-circle" className="w-4 h-4" />
        <span>
          Missing required field(s): {missingLabels.join(", ")} (publishing
          disabled)
        </span>
      </div>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
      <Icon name="check-circle" className="w-4 h-4" />
      <span>
        Ready to publish • {event.roles.filter((r) => r.openToPublic).length}{" "}
        public role(s)
      </span>
    </div>
  );
}

export default PublishReadinessInline;
