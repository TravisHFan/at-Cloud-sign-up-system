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
              navigate(`/guest/register/${event.id}`);
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
              navigate(`/guest/register/${event.id}`);
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
                (event as any).endDate
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

          {/* Additional Event Details for Guests */}
          {isGuest && (
            <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
              {/* Hosted By */}
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-4 0H3m2 0h6m-4 0v-5a2 2 0 012-2h4a2 2 0 012 2v5"
                  />
                </svg>
                <span className="text-gray-700 font-medium">Hosted by:</span>
                <span className="ml-2">
                  {event.hostedBy || "@Cloud Marketplace Ministry"}
                </span>
              </div>

              {/* Purpose */}
              <div>
                <div className="flex items-start">
                  <svg
                    className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <span className="text-gray-700 font-medium">Purpose:</span>
                    <p className="text-gray-600 mt-1">{event.purpose}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <div>
                  <div className="flex items-start">
                    <svg
                      className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div>
                      <span className="text-gray-700 font-medium">
                        Description:
                      </span>
                      <p className="text-gray-600 mt-1">{event.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Event Agenda */}
              {event.agenda && (
                <div>
                  <div className="flex items-start">
                    <svg
                      className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                      />
                    </svg>
                    <div>
                      <span className="text-gray-700 font-medium">
                        Event Agenda:
                      </span>
                      <p className="text-gray-600 mt-1 whitespace-pre-line">
                        {event.agenda}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Requirements */}
              {event.requirements && (
                <div>
                  <div className="flex items-start">
                    <svg
                      className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <span className="text-gray-700 font-medium">
                        Requirements:
                      </span>
                      <p className="text-gray-600 mt-1">{event.requirements}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Materials Needed */}
              {event.materials && (
                <div>
                  <div className="flex items-start">
                    <svg
                      className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                    <div>
                      <span className="text-gray-700 font-medium">
                        Materials Needed:
                      </span>
                      <p className="text-gray-600 mt-1">{event.materials}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Workshop Group Topics */}
              {event.type === "Effective Communication Workshop" &&
                event.workshopGroupTopics && (
                  <div>
                    <div className="flex items-start">
                      <svg
                        className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <div>
                        <span className="text-gray-700 font-medium">
                          Group Practice Topics:
                        </span>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(["A", "B", "C", "D", "E", "F"] as const).map(
                            (group) => {
                              const topic = event.workshopGroupTopics?.[group];
                              return topic ? (
                                <div
                                  key={group}
                                  className="bg-gray-50 rounded p-2"
                                >
                                  <div className="text-xs font-medium text-gray-700">
                                    Group {group}:
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {topic}
                                  </div>
                                </div>
                              ) : null;
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Disclaimer */}
              {event.disclaimer && (
                <div>
                  <div className="flex items-start">
                    <svg
                      className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <div>
                      <span className="text-gray-700 font-medium">
                        Disclaimer:
                      </span>
                      <p className="text-gray-600 mt-1">{event.disclaimer}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Online Meeting Information Notice for Guests */}
              {(event.format === "Online" ||
                event.format === "Hybrid Participation") && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <svg
                      className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <div>
                      <span className="text-blue-800 font-medium text-sm">
                        Online Meeting Information:
                      </span>
                      <p className="text-blue-700 text-sm mt-1">
                        Upon registration, the meeting link and event details
                        will be sent to you via email.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
