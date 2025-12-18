import React from "react";
import type { EventData } from "../../types/event";
import { PUBLISH_FIELD_LABELS } from "../../types/event";

interface Props {
  event: Partial<EventData>;
  className?: string;
}

/**
 * Warning banner shown when a published event is in the 48-hour grace period
 * due to missing required fields. After the grace period, the event will be
 * automatically unpublished if the fields are not filled in.
 */
export const GracePeriodBanner: React.FC<Props> = ({ event, className }) => {
  // Only show if event is published AND scheduled for unpublish
  if (!event.publish || !event.unpublishScheduledAt) {
    return null;
  }

  const deadline = new Date(event.unpublishScheduledAt);
  const now = Date.now();
  const msRemaining = Math.max(0, deadline.getTime() - now);
  const hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));

  // If deadline has passed, don't show (backend will unpublish)
  if (msRemaining <= 0) {
    return null;
  }

  const missingFields = event.unpublishWarningFields || [];
  const missingLabels = missingFields.map((f) => PUBLISH_FIELD_LABELS[f] || f);

  return (
    <div
      className={
        "rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm " +
        (className || "")
      }
      role="alert"
      data-testid="grace-period-banner"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block bg-red-500 text-white px-1.5 py-0.5 rounded text-xs uppercase tracking-wide font-semibold">
          Action Required
        </span>
        <span className="font-semibold">
          {hoursRemaining} hour{hoursRemaining !== 1 ? "s" : ""} until
          auto-unpublish
        </span>
      </div>
      <p className="mb-1">
        This event is missing required fields for a{" "}
        <strong>{event.format || "—"}</strong> event:
      </p>
      {missingLabels.length > 0 ? (
        <ul className="list-disc ml-5 mb-2">
          {missingLabels.map((lbl) => (
            <li key={lbl}>{lbl}</li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs italic">
          (Missing fields not specified — please check event requirements)
        </p>
      )}
      <p className="text-xs text-red-700">
        Fill in the missing field(s) to keep the event published. Otherwise, it
        will be automatically unpublished when the grace period ends.
      </p>
    </div>
  );
};
