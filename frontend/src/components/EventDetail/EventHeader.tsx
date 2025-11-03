import { useNavigate } from "react-router-dom";
import { Icon } from "../common";
import EditButton from "../common/EditButton";
import PublishStatusCard from "./PublishStatusCard";
import { useToastReplacement } from "../../contexts/NotificationModalContext";
import type { EventData } from "../../types/event";

interface EventHeaderProps {
  event: EventData;
  isPassedEvent: boolean;
  canManageSignups: boolean | null;
  canDeleteEvent: boolean | null;
  publishing: boolean;
  setPublishing: (b: boolean) => void;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  notification: ReturnType<typeof useToastReplacement>;
  setShowShareModal: (show: boolean) => void;
  setShowDeletionModal: (show: boolean) => void;
  handleDownloadCalendar: () => void;
}

function EventHeader({
  event,
  isPassedEvent,
  canManageSignups,
  canDeleteEvent,
  publishing,
  setPublishing,
  setEvent,
  notification,
  setShowShareModal,
  setShowDeletionModal,
  handleDownloadCalendar,
}: EventHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Title Row */}
      <div className="flex items-center space-x-4 mb-4">
        <button
          onClick={() => {
            // Smart back navigation: go to the previous page if it's a dashboard page,
            // otherwise fall back to upcoming events
            const referrer = document.referrer;
            const dashboardPages = [
              "/dashboard/upcoming",
              "/dashboard/passed",
              "/dashboard/my-events",
              "/dashboard/published-events",
            ];

            // Check if referrer is from one of our dashboard pages
            const isFromDashboard = dashboardPages.some((page) =>
              referrer.includes(page)
            );

            if (isFromDashboard && window.history.length > 1) {
              // Go back in browser history
              navigate(-1);
            } else {
              // Fall back to upcoming events if no valid referrer
              navigate("/dashboard/upcoming");
            }
          }}
          className="text-gray-600 hover:text-gray-900"
          title="⬅️（go back）"
        >
          <Icon name="arrow-left" className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          {event.title}
          {isPassedEvent && (
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              Completed
            </span>
          )}
        </h1>
      </div>
      {/* Publish / Public URL Bar */}
      {canManageSignups && event && (
        <PublishStatusCard
          event={event}
          publishing={publishing}
          setPublishing={setPublishing}
          setEvent={setEvent}
          notification={notification}
          setShowShareModal={setShowShareModal}
        />
      )}{" "}
      {/* Action Buttons Row - Edit and Delete for authorized users, Add to Calendar for all */}
      <div className="flex items-center space-x-3 mb-4">
        {!isPassedEvent && (
          <>
            {canDeleteEvent && (
              <EditButton
                onClick={() =>
                  navigate(`/dashboard/edit-event/${event.id}`, {
                    state: { returnTo: `/dashboard/event/${event.id}` },
                  })
                }
                title="Edit Event"
              />
            )}
            {canDeleteEvent && (
              <button
                onClick={() => setShowDeletionModal(true)}
                className="inline-flex items-center px-4 py-2 border border-red-600 shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors h-10"
              >
                Delete Event
              </button>
            )}
          </>
        )}
        {/* Add to Calendar button - available to all users */}
        <button
          onClick={handleDownloadCalendar}
          className="inline-flex items-center px-4 py-2 border border-blue-600 shadow-sm text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors h-10"
        >
          <Icon name="calendar" className="h-4 w-4 mr-1.5" />
          Add to Calendar
        </button>
      </div>
    </div>
  );
}

export default EventHeader;
