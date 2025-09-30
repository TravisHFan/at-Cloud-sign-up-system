import React from "react";
import type { EventData } from "../../types/event";
import { usePublishReadiness } from "../../hooks/usePublishReadiness";

interface Props {
  event: Partial<EventData>;
  onPublish: () => void;
  disabled?: boolean; // external disabling (e.g., pending save)
  className?: string;
}

export const PublishButton: React.FC<Props> = ({
  event,
  onPublish,
  disabled,
  className,
}) => {
  const { isReady, missingLabels } = usePublishReadiness(event);
  const effectiveDisabled = disabled || !isReady;
  return (
    <div className={className || ""}>
      <button
        type="button"
        onClick={onPublish}
        disabled={effectiveDisabled}
        className={`px-4 py-2 rounded-md text-white text-sm font-medium shadow transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 ${
          effectiveDisabled
            ? "bg-gray-400"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
        data-testid="publish-button"
        title={
          effectiveDisabled && missingLabels.length
            ? "Missing: " + missingLabels.join(", ")
            : "Publish event"
        }
      >
        Publish
      </button>
      {!isReady && missingLabels.length > 0 && (
        <p
          className="mt-1 text-xs text-gray-600"
          data-testid="publish-button-hint"
        >
          Missing: {missingLabels.join(", ")}
        </p>
      )}
    </div>
  );
};
