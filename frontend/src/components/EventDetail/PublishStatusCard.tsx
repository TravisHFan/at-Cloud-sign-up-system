import { useState } from "react";
import { PublishGateBanner } from "../publish/PublishGateBanner";
import { GracePeriodBanner } from "../publish/GracePeriodBanner";
import PublishReadinessInline from "./PublishReadinessInline";
import PublishActionButton from "./PublishActionButton";
import { useToastReplacement } from "../../contexts/NotificationModalContext";
import { eventService } from "../../services/api";
import type { EventData } from "../../types/event";

interface PublishStatusCardProps {
  event: EventData;
  publishing: boolean;
  setPublishing: (b: boolean) => void;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  notification: ReturnType<typeof useToastReplacement>;
  setShowShareModal: (show: boolean) => void;
}

function PublishStatusCard({
  event,
  publishing,
  setPublishing,
  setEvent,
  notification,
  setShowShareModal,
}: PublishStatusCardProps) {
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  return (
    <div className="mb-6">
      {!event.publish && <PublishGateBanner event={event} className="mb-4" />}
      {event.publish && <GracePeriodBanner event={event} className="mb-4" />}
      <div className="border rounded-lg p-4 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-800">
              Public Availability:
            </span>
            {event.publish ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold">
                Published
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-xs font-semibold">
                Private
              </span>
            )}
          </div>
          {event.publish && event.publicSlug && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/p/${event.publicSlug}`
                    );
                    setCopyNotice("Copied!");
                    setTimeout(() => setCopyNotice(null), 1600);
                  } catch {
                    setCopyNotice("Copy failed");
                    setTimeout(() => setCopyNotice(null), 1800);
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-700 truncate max-w-xs"
                title={`${window.location.origin}/p/${event.publicSlug}`}
              >
                {copyNotice ||
                  `${window.location.origin}/p/${event.publicSlug}`}
              </button>
            </div>
          )}
          {!event.publish && <PublishReadinessInline event={event} />}
          {event.publish && event.publishedAt && (
            <p className="text-[10px] text-gray-500 mt-1">
              First published {new Date(event.publishedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {event.publish && (
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="px-4 py-2 text-sm font-medium rounded-md shadow-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                />
              </svg>
              Share
            </button>
          )}
          <PublishActionButton
            event={event}
            publishing={publishing}
            setPublishing={setPublishing}
            setEvent={setEvent}
            notification={notification}
            eventService={eventService}
          />
        </div>
      </div>
      {/* Public Roles Summary */}
      {event.roles.some((r) => r.openToPublic) && (
        <div className="mt-3 p-3 bg-blue-50 rounded-md">
          <div className="text-xs font-medium text-blue-800 mb-1">
            Public Roles ({event.roles.filter((r) => r.openToPublic).length} of{" "}
            {event.roles.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {event.roles
              .filter((r) => r.openToPublic)
              .map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800"
                >
                  {role.name}
                  {role.capacityRemaining !== undefined && (
                    <span className="ml-1 text-green-600">
                      ({role.capacityRemaining} left)
                    </span>
                  )}
                </span>
              ))}
          </div>
          <div className="text-xs text-blue-700 mt-1">
            These roles will accept public registrations when published
          </div>
        </div>
      )}
    </div>
  );
}

export default PublishStatusCard;
