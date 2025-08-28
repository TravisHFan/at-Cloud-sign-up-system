import type { EventData } from "../../types/event";
import { formatEventDateTimeRangeInViewerTZ } from "../../utils/eventStatsUtils";
import { EventDeletionModal } from "../common";
import { Button, Badge } from "../ui";
import {
  getEventStatusBadge,
  getAvailabilityBadge as getAvailabilityBadgeUtil,
} from "../../utils/uiUtils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

interface EventListItemProps {
  event: EventData;
  type: "upcoming" | "passed";
  onSignUp?: (eventId: string) => void;
  onViewDetails?: (eventId: string) => void;
  onDelete?: (eventId: string) => Promise<void>;
  onCancel?: (eventId: string) => Promise<void>;
  onEdit?: (eventId: string) => void;
  canDelete?: boolean;
  isGuest?: boolean;
}

export default function EventListItem({
  event,
  type,
  onSignUp: _onSignUp,
  onViewDetails: _onViewDetails,
  onDelete,
  onCancel,
  onEdit,
  canDelete = false,
  isGuest = false,
}: EventListItemProps) {
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Check if current user can edit this event
  const canEdit = (() => {
    if (!currentUser || type === "passed") return false;

    const currentUserRole = currentUser.role;
    const currentUserId = currentUser.id;

    // Super Admin and Administrator can edit any event
    if (
      currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator"
    ) {
      return true;
    }

    // Check if current user is an organizer of this event
    const isCurrentUserOrganizer =
      // Check if user is in organizerDetails array
      event.organizerDetails?.some(
        (organizer) =>
          organizer.name
            .toLowerCase()
            .includes(currentUser?.firstName?.toLowerCase() || "") &&
          organizer.name
            .toLowerCase()
            .includes(currentUser?.lastName?.toLowerCase() || "")
      ) ||
      // Check if user is the event creator
      event.createdBy === currentUserId ||
      // Check if user is in the organizer string field
      event.organizer
        ?.toLowerCase()
        .includes(
          `${currentUser?.firstName} ${currentUser?.lastName}`.toLowerCase()
        );

    return isCurrentUserOrganizer;
  })();
  const getStatusBadge = () => {
    const statusBadge = getEventStatusBadge(event.status || "active", type);
    return (
      <Badge
        variant={statusBadge.className.includes("red") ? "error" : "success"}
      >
        {statusBadge.text}
      </Badge>
    );
  };

  // Helper function to check if event is currently ongoing
  const isEventOngoing = () => {
    const now = new Date();
    const eventStart = new Date(`${event.date}T${event.time}`);
    const eventEnd = new Date(`${event.date}T${event.endTime}`);

    return now >= eventStart && now <= eventEnd;
  };

  // Get ongoing badge if event is currently happening
  const getOngoingBadge = () => {
    if (type === "passed" || !isEventOngoing()) return null;

    return <Badge variant="warning">Ongoing</Badge>;
  };

  const getAvailabilityBadge = () => {
    if (type === "passed") return null;

    const spotsLeft = event.totalSlots - event.signedUp;
    const availabilityBadge = getAvailabilityBadgeUtil(spotsLeft);

    if (!availabilityBadge) return null;

    const variant = availabilityBadge.className.includes("red")
      ? "error"
      : "warning";
    return <Badge variant={variant}>{availabilityBadge.text}</Badge>;
  };

  // Handle deletion functions
  const handleDeleteEvent = async () => {
    if (onDelete) {
      await onDelete(event.id);
    }
  };

  const handleCancelEvent = async () => {
    if (onCancel) {
      await onCancel(event.id);
    }
  };

  const getActionButton = () => {
    if (type === "passed") {
      return (
        <Button
          variant="outline"
          onClick={() => {
            if (isGuest) {
              // For guests, navigate to registration page even for passed events
              navigate(`/guest-register/${event.id}`);
            } else {
              navigate(`/dashboard/event/${event.id}`);
            }
          }}
        >
          View Details
        </Button>
      );
    }

    // For upcoming events
    if (event.status === "cancelled") {
      return (
        <div className="flex items-center space-x-2">
          <span className="px-4 py-2 bg-red-100 text-red-800 rounded-md text-sm font-medium">
            This event has been cancelled by the Organizers
          </span>
          {canDelete && (
            <Button
              onClick={() => setShowDeletionModal(true)}
              variant="outline"
              size="small"
              className="text-red-600 border-red-600 hover:bg-red-50"
              title="Delete Event"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </Button>
          )}
        </div>
      );
    }

    const spotsLeft = event.totalSlots - event.signedUp;
    const isFull = spotsLeft === 0;

    return (
      <div className="flex items-center space-x-2">
        <Button
          onClick={() => {
            if (isGuest) {
              // For guests, always navigate to registration page
              navigate(`/guest-register/${event.id}`);
            } else {
              navigate(`/dashboard/event/${event.id}`);
            }
          }}
          disabled={isFull}
          variant={isFull ? "secondary" : "primary"}
          className={isFull ? "cursor-not-allowed" : ""}
        >
          {isFull ? "Full" : "View & Sign Up"}
        </Button>
        {canEdit && onEdit && (
          <Button
            onClick={() => onEdit(event.id)}
            variant="outline"
            size="small"
            className="text-blue-600 border-blue-600 hover:bg-blue-50"
            title="Edit Event"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </Button>
        )}
        {canDelete && (
          <Button
            onClick={() => setShowDeletionModal(true)}
            variant="outline"
            size="small"
            className="text-red-600 border-red-600 hover:bg-red-50"
            title="Delete Event"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
          <div className="flex items-center space-x-2">
            {getOngoingBadge()}
            {getStatusBadge()}
            {getAvailabilityBadge()}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-4 text-sm text-gray-600">
          {/* Date and Time - Full width */}
          <div className="flex items-center min-w-0">
            <svg
              className="w-4 h-4 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="truncate">
              {formatEventDateTimeRangeInViewerTZ(
                event.date,
                event.time,
                event.endTime,
                event.timeZone,
                event.endDate
              )}
            </span>
            {event.timeZone ? (
              <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
                (shown in your local time)
              </span>
            ) : null}
          </div>

          {/* Two column grid for other details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="truncate">{event.location}</span>
            </div>
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="truncate">{event.organizer}</span>
            </div>
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              Format: {event.format}
            </div>
            <div className="flex items-center">
              <svg
                className="w-4 h-4 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Type: {event.type || "No Type"}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span>
              {event.signedUp}/{event.totalSlots} signed up
            </span>
          </div>
          {getActionButton()}
        </div>
      </div>

      {/* Event Deletion Modal */}
      <EventDeletionModal
        isOpen={showDeletionModal}
        onClose={() => setShowDeletionModal(false)}
        onDelete={handleDeleteEvent}
        onCancel={handleCancelEvent}
        eventTitle={event.title}
      />
    </>
  );
}
