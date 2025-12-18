import React from "react";
import type { EventData } from "../../types/event";
import {
  PUBLISH_FIELD_LABELS,
  getMissingNecessaryFieldsForPublishFrontend,
} from "../../types/event";

interface Props {
  event: Partial<EventData>;
  className?: string;
}

/**
 * Warning banner shown when a published event has missing required fields.
 * Shows the fields that need to be filled in to keep the event published.
 * If a grace period is active (unpublishScheduledAt set), shows countdown.
 */
export const GracePeriodBanner: React.FC<Props> = ({ event, className }) => {
  // Calculate missing fields directly on frontend for immediate responsiveness
  const missingFields = getMissingNecessaryFieldsForPublishFrontend(event);

  // Only show if event is published AND has missing required fields
  if (!event.publish || missingFields.length === 0) {
    return null;
  }

  const missingLabels = missingFields.map((f) => PUBLISH_FIELD_LABELS[f] || f);

  // Check if backend has set a grace period deadline
  const hasGracePeriod = !!event.unpublishScheduledAt;
  let hoursRemaining = 0;
  let deadlinePassed = false;

  if (hasGracePeriod) {
    const deadline = new Date(event.unpublishScheduledAt!);
    const msRemaining = Math.max(0, deadline.getTime() - Date.now());
    hoursRemaining = Math.ceil(msRemaining / (1000 * 60 * 60));
    deadlinePassed = msRemaining <= 0;
  }

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
        {hasGracePeriod && !deadlinePassed && (
          <span className="font-semibold">
            {hoursRemaining} hour{hoursRemaining !== 1 ? "s" : ""} until
            auto-unpublish
          </span>
        )}
        {hasGracePeriod && deadlinePassed && (
          <span className="font-semibold text-red-700">
            Auto-unpublish imminent
          </span>
        )}
      </div>
      <p className="mb-1">
        This event is missing required fields for a{" "}
        <strong>{event.format || "—"}</strong> event:
      </p>
      <ul className="list-disc ml-5 mb-2">
        {missingLabels.map((lbl) => (
          <li key={lbl}>{lbl}</li>
        ))}
      </ul>
      <p className="text-xs text-red-700">
        {hasGracePeriod
          ? "Fill in the missing field(s) to keep the event published. Otherwise, it will be automatically unpublished when the grace period ends."
          : "Fill in the missing field(s) to ensure the event stays published. A 48-hour grace period will start after the next update."}
      </p>
    </div>
  );
};
