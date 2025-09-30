import { useMemo } from "react";
import {
  getMissingNecessaryFieldsForPublishFrontend,
  PUBLISH_FIELD_LABELS,
} from "../types/event";
import type { EventData } from "../types/event";

export interface PublishReadiness {
  missing: string[];
  missingLabels: string[];
  isReady: boolean;
  message: string;
}

export function usePublishReadiness(
  event: Partial<EventData>
): PublishReadiness {
  return useMemo(() => {
    const missing = getMissingNecessaryFieldsForPublishFrontend(event);
    const missingLabels = missing.map((m) => PUBLISH_FIELD_LABELS[m] || m);
    const isReady = missing.length === 0;
    const message = isReady
      ? "All required fields present for publishing."
      : "Add: " + missingLabels.join(", ");
    return { missing, missingLabels, isReady, message };
  }, [
    event.format,
    event.zoomLink,
    event.meetingId,
    event.passcode,
    event.location,
    event.purpose,
  ]);
}
