import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../common";
import EditButton from "../common/EditButton";
import PublishStatusCard from "./PublishStatusCard";
import { useToastReplacement } from "../../contexts/NotificationModalContext";
import { eventsService } from "../../services/api/events.api";
import type { EventData, EventParticipant } from "../../types/event";

// Backend response types for registration data transformation
interface BackendUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  gender?: string;
  systemAuthorizationLevel?: string;
  roleInAtCloud?: string;
  role?: string;
}

interface BackendRegistration {
  id: string;
  userId: string;
  user: BackendUser;
  notes?: string;
  registeredAt?: string;
}

interface BackendRole {
  id: string;
  name: string;
  description: string;
  agenda?: string;
  maxParticipants: number;
  openToPublic?: boolean;
  registrations?: BackendRegistration[];
  currentSignups?: EventParticipant[] | number;
}

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
  showGetTicketButton?: boolean;
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
  showGetTicketButton = false,
}: EventHeaderProps) {
  const navigate = useNavigate();

  // YouTube URL modal state
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState(
    event.youtubeUrl || "",
  );
  const [submittingYoutubeUrl, setSubmittingYoutubeUrl] = useState(false);

  // Handle YouTube URL submission
  const handleYoutubeSubmit = async () => {
    if (submittingYoutubeUrl) return;

    const urlToSubmit = youtubeUrlInput.trim() || null;

    // Basic validation for YouTube URL format
    if (urlToSubmit) {
      const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/;
      if (!youtubeRegex.test(urlToSubmit)) {
        notification.error(
          "Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=...)",
        );
        return;
      }
    }

    setSubmittingYoutubeUrl(true);
    try {
      const updatedEvent = await eventsService.updateYoutubeUrl(
        event.id,
        urlToSubmit,
      );

      // Transform backend response to frontend format
      // Backend returns `registrations` array, frontend expects `currentSignups` array
      const backendRoles = updatedEvent.roles as unknown as BackendRole[];
      const convertedEvent: EventData = {
        ...updatedEvent,
        roles: backendRoles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          agenda: role.agenda,
          maxParticipants: role.maxParticipants,
          openToPublic: role.openToPublic,
          // Convert registrations array to currentSignups array
          currentSignups: role.registrations
            ? role.registrations.map((reg) => ({
                userId: reg.user.id,
                username: reg.user.username,
                firstName: reg.user.firstName,
                lastName: reg.user.lastName,
                email: reg.user.email,
                phone: reg.user.phone,
                avatar: reg.user.avatar,
                gender: reg.user.gender as "male" | "female" | undefined,
                systemAuthorizationLevel:
                  reg.user.role || reg.user.systemAuthorizationLevel,
                roleInAtCloud: reg.user.roleInAtCloud,
                notes: reg.notes,
              }))
            : Array.isArray(role.currentSignups)
              ? role.currentSignups
              : [],
        })),
      };

      setEvent(convertedEvent);
      setShowYoutubeModal(false);
      notification.success(
        urlToSubmit
          ? "YouTube link added successfully!"
          : "YouTube link removed successfully!",
      );
    } catch (error) {
      notification.error(
        error instanceof Error
          ? error.message
          : "Failed to update YouTube link",
      );
    } finally {
      setSubmittingYoutubeUrl(false);
    }
  };

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
              referrer.includes(page),
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
        {/* Add to Calendar button - only for upcoming/ongoing events */}
        {!isPassedEvent && (
          <button
            onClick={handleDownloadCalendar}
            className="inline-flex items-center px-4 py-2 border border-blue-600 shadow-sm text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors h-10"
          >
            <Icon name="calendar" className="h-4 w-4 mr-1.5" />
            Add to Calendar
          </button>
        )}
        {/* Get Ticket button - shown when user needs to purchase */}
        {showGetTicketButton && (
          <button
            onClick={() => navigate(`/dashboard/events/${event.id}/purchase`)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors h-10"
          >
            <Icon name="lock" className="h-4 w-4 mr-1.5" />
            Get Ticket Now
          </button>
        )}
        {/* Add YouTube Link button - only for past events and authorized users */}
        {isPassedEvent && canDeleteEvent && (
          <button
            onClick={() => {
              setYoutubeUrlInput(event.youtubeUrl || "");
              setShowYoutubeModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-red-500 shadow-sm text-sm font-medium rounded-md text-red-500 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors h-10"
          >
            <Icon name="play" className="h-4 w-4 mr-1.5" />
            {event.youtubeUrl ? "Edit YouTube Link" : "Add YouTube Link"}
          </button>
        )}
      </div>
      {/* YouTube URL Modal */}
      {showYoutubeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {event.youtubeUrl ? "Edit YouTube Link" : "Add YouTube Link"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Paste the YouTube video URL for this completed event.
            </p>
            <input
              type="url"
              value={youtubeUrlInput}
              onChange={(e) => setYoutubeUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              {event.youtubeUrl && (
                <button
                  onClick={async () => {
                    setYoutubeUrlInput("");
                    await handleYoutubeSubmit();
                  }}
                  disabled={submittingYoutubeUrl}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Remove Link
                </button>
              )}
              <button
                onClick={() => setShowYoutubeModal(false)}
                disabled={submittingYoutubeUrl}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleYoutubeSubmit}
                disabled={submittingYoutubeUrl}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {submittingYoutubeUrl ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventHeader;
