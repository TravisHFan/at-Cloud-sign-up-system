import React from "react";
import type { EventData } from "../../types/event";
import { usePublishReadiness } from "../../hooks/usePublishReadiness";

interface Props {
  event: Partial<EventData>;
  className?: string;
}

export const PublishGateBanner: React.FC<Props> = ({ event, className }) => {
  const { isReady, missingLabels } = usePublishReadiness(event);
  if (isReady) return null;
  return (
    <div
      className={
        "rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm " +
        (className || "")
      }
      role="alert"
      data-testid="publish-gate-banner"
    >
      <p className="font-semibold mb-1">Cannot publish yet</p>
      <p className="mb-1">
        Add the following required field(s) for a {event.format || "—"} event:
      </p>
      <ul className="list-disc ml-5 mb-2">
        {missingLabels.map((lbl) => (
          <li key={lbl}>{lbl}</li>
        ))}
      </ul>
      <p className="text-xs text-amber-700">
        Once all required fields are present, the Publish button will be
        enabled.
      </p>
    </div>
  );
};
