import Multiline from "../components/common/Multiline";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/common";
import { getAvatarUrlWithCacheBust, getAvatarAlt } from "../utils/avatarUtils";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { useAuth } from "../hooks/useAuth";
import { useAvatarUpdates } from "../hooks/useAvatarUpdates";
import { formatDateToAmerican } from "../utils/eventStatsUtils";
import { hasUnlimitedRoles } from "../utils/roleRegistrationLimits";
import { useRoleLimits } from "../hooks/useRoleLimits";
import { useEventPermissions } from "../hooks/useEventPermissions";
import { useWorkshopGroups } from "../hooks/useWorkshopGroups";
import { useGuestModals } from "../hooks/useGuestModals";
import { useDragDropHandlers } from "../hooks/useDragDropHandlers";
import { useSignupHandlers } from "../hooks/useSignupHandlers";
import { useEventActions } from "../hooks/useEventActions";
import { useProgramAccess } from "../hooks/useProgramAccess";
import { useEmailModal } from "../hooks/useEmailModal";
import { useEventData } from "../hooks/useEventData";
import { useRealtimeEventUpdates } from "../hooks/useRealtimeEventUpdates";
import WorkshopGroupsSection from "../components/EventDetail/WorkshopGroupsSection";
import EventModals from "../components/EventDetail/EventModals";
import EventRolesSection from "../components/EventDetail/EventRolesSection";
import FlyerDisplay from "../components/EventDetail/FlyerDisplay";
import EventBasicDetails from "../components/EventDetail/EventBasicDetails";
import EventHostAndPurpose from "../components/EventDetail/EventHostAndPurpose";
import EventCapacityAndAgenda from "../components/EventDetail/EventCapacityAndAgenda";
import EventHeader from "../components/EventDetail/EventHeader";
import ProgramAccessModal from "../components/EventDetail/ProgramAccessModal";
import LoadingSpinner from "../components/common/LoadingSpinner";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const notification = useToastReplacement();

  // Listen for real-time avatar updates to refresh organizer/participant avatars
  useAvatarUpdates();

  // Keep a stable reference for notifications inside effects
  const notificationRef = useRef(notification);
  useEffect(() => {
    notificationRef.current = notification;
  }, [notification]);

  // Use current user from auth context
  const currentUserId =
    currentUser?.id || "550e8400-e29b-41d4-a716-446655440000";
  const currentUserRole = currentUser?.role || "Super Admin";

  // Use custom hook for event data fetching and WebSocket updates
  const { event, setEvent, loading, guestsByRole, setGuestsByRole } =
    useEventData({
      id,
      currentUserId,
      navigate,
      notificationRef,
      locationPathname: location.pathname,
    });

  // Publishing UI state
  const [publishing, setPublishing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Use custom hook for program access and names
  const {
    programNames,
    showAccessModal,
    setShowAccessModal,
    blockedProgramId,
    blockedProgramName,
    checkingAccess,
  } = useProgramAccess({
    event,
    currentUser,
  });

  const [managementMode, setManagementMode] = useState(false);
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  // Use custom hook for guest modal state management
  const {
    cancelConfirm,
    setCancelConfirm,
    editGuest,
    setEditGuest,
    resendLinkConfirm,
    setResendLinkConfirm,
  } = useGuestModals();

  // Use custom hook for email modal and editor
  const { emailModal, setEmailModal, emailEditorRef, applyEditorCommand } =
    useEmailModal();

  // Name card action modal state
  const [nameCardModal, setNameCardModal] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
    userRole?: string;
  }>({
    isOpen: false,
    userId: "",
    userName: "",
    userRole: "",
  });

  // Use custom hook for multi-role limit tracking (NEW POLICY 2025-10-10)
  const {
    userSignedUpRoles,
    maxRolesForUser,
    userDistinctRoleCount: _userDistinctRoleCount,
    hasReachedMaxRoles,
    isUserSignedUp,
  } = useRoleLimits(event, currentUserId, currentUser?.role);

  // Use custom hook for permission checks
  const {
    canNavigateToProfiles,
    isCurrentUserRegistered: _isCurrentUserRegistered,
    getProfileLink: _getProfileLink,
    handleNameCardClick,
    isCurrentUserOrganizer,
    canDeleteEvent,
    isPassedEvent,
    canManageSignups,
    isRoleAllowedForUser,
  } = useEventPermissions({
    event,
    currentUser,
    currentUserId,
    currentUserRole,
    setNameCardModal,
  });

  // Use custom hook for workshop group topic editing
  const {
    editingGroup,
    topicDraft,
    setTopicDraft,
    canEditWorkshopGroup,
    startEditTopic,
    cancelEditTopic,
    saveTopic,
  } = useWorkshopGroups({
    event,
    currentUser,
    setEvent,
    notification,
  });

  // Use custom hook for drag-and-drop handlers
  const {
    draggedUserId,
    draggedGuestId,
    handleDragStart,
    handleGuestDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  } = useDragDropHandlers({
    event,
    setEvent,
    guestsByRole,
    setGuestsByRole,
    notification,
  });

  // Use custom hook for signup handlers
  const { handleRoleSignup, handleRoleCancel, handleManagementCancel } =
    useSignupHandlers({
      event,
      currentUser,
      setEvent,
      notification,
      navigate,
      handleDownloadCalendar: async () => {
        // Forward declaration - will be defined by useEventActions below
        await handleDownloadCalendar();
      },
    });

  // Use custom hook for event actions
  const {
    handleDownloadCalendar,
    handleExportSignups,
    handleDeleteEvent,
    handleCancelEvent,
  } = useEventActions({
    event,
    setEvent,
    setManagementMode,
    notification,
    navigate,
  });

  // Use custom hook for real-time WebSocket event updates
  useRealtimeEventUpdates({
    eventId: id,
    currentUserId,
    setEvent,
    setGuestsByRole,
    notification,
    locationPathname: location.pathname,
  });

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Event Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          The event you're looking for doesn't exist.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Access Check Loading Overlay */}
      {checkingAccess && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-lg shadow-xl p-6 flex items-center gap-3">
            <LoadingSpinner inline size="sm" />
            <span className="text-gray-700">Checking access...</span>
          </div>
        </div>
      )}

      {/* Program Access Restriction Modal */}
      <ProgramAccessModal
        isOpen={showAccessModal && !!blockedProgramId}
        onClose={() => setShowAccessModal(false)}
        programId={blockedProgramId || ""}
        programName={blockedProgramName || ""}
      />

      {/* Event Header */}
      <EventHeader
        event={event}
        isPassedEvent={isPassedEvent}
        canManageSignups={canManageSignups}
        canDeleteEvent={canDeleteEvent}
        publishing={publishing}
        setPublishing={setPublishing}
        setEvent={setEvent}
        notification={notification}
        setShowShareModal={setShowShareModal}
        setShowDeletionModal={setShowDeletionModal}
        handleDownloadCalendar={handleDownloadCalendar}
      />
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        {/* Event Details */}
        <EventBasicDetails event={event} />
        <EventHostAndPurpose event={event} />
        {/* Description removed */}
        <EventCapacityAndAgenda event={event} />
        {/* Event Flyer (optional) - now supports carousel for multiple flyers */}
        <FlyerDisplay event={event} />
        <div className="space-y-4">
          {/* Organizer Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Organizer Contact Information
            </h3>

            {/* Primary Organizer */}
            {(() => {
              const createdBy =
                typeof event.createdBy === "object"
                  ? event.createdBy
                  : undefined;
              const hasCreatedByDetails = !!createdBy;

              if (
                !hasCreatedByDetails &&
                (!event.organizerDetails || event.organizerDetails.length === 0)
              ) {
                return (
                  <p className="text-gray-700">
                    {event.organizer || "No organizer specified."}
                  </p>
                );
              }

              return (
                <div className="space-y-4">
                  {hasCreatedByDetails && (
                    <div>
                      <div className="block text-sm font-medium text-gray-700 mb-2">
                        Organizer
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-start space-x-3 mb-3">
                            <img
                              src={getAvatarUrlWithCacheBust(
                                createdBy?.avatar || null,
                                createdBy?.gender || "male"
                              )}
                              alt={getAvatarAlt(
                                createdBy?.firstName || "",
                                createdBy?.lastName || "",
                                !!createdBy?.avatar
                              )}
                              className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 mb-1">
                                {`${createdBy?.firstName || ""} ${
                                  createdBy?.lastName || ""
                                }`}
                                {createdBy?.id === currentUserId && (
                                  <span className="ml-2 text-xs text-blue-600 font-normal">
                                    (You)
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                {String(
                                  createdBy?.roleInAtCloud ||
                                    createdBy?.role ||
                                    createdBy?.systemAuthorizationLevel ||
                                    ""
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Only show contact links if present */}
                          {(createdBy?.email || createdBy?.phone) && (
                            <div className="space-y-1">
                              {createdBy?.email && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <Icon
                                    name="envelope"
                                    className="w-3.5 h-3.5 mr-3"
                                  />
                                  <a
                                    href={`mailto:${createdBy?.email}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {createdBy?.email}
                                  </a>
                                </div>
                              )}
                              {createdBy?.phone && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <Icon
                                    name="phone"
                                    className="w-3.5 h-3.5 mr-3"
                                  />
                                  <a
                                    href={`tel:${createdBy?.phone}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {createdBy?.phone}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Co-organizers */}
                  <div>
                    <div className="block text-sm font-medium text-gray-700 mb-2">
                      Co-organizers
                    </div>
                    {event.organizerDetails &&
                    event.organizerDetails.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {event.organizerDetails.map((organizer, index) => {
                          const isClickable =
                            organizer.userId &&
                            (canNavigateToProfiles ||
                              organizer.userId === currentUserId);

                          return (
                            <div
                              key={index}
                              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                            >
                              <div
                                className={`flex items-start space-x-3 mb-3 ${
                                  isClickable
                                    ? "cursor-pointer hover:bg-gray-100 -mx-2 -my-1 px-2 py-1 rounded-md transition-colors"
                                    : ""
                                }`}
                                onClick={() => {
                                  if (isClickable && organizer.userId) {
                                    handleNameCardClick(
                                      organizer.userId,
                                      organizer.name,
                                      organizer.role
                                    );
                                  }
                                }}
                                title={
                                  isClickable
                                    ? `Click to interact with ${organizer.name}`
                                    : undefined
                                }
                              >
                                <img
                                  src={getAvatarUrlWithCacheBust(
                                    organizer.avatar || null,
                                    organizer.gender || "male"
                                  )}
                                  alt={getAvatarAlt(
                                    organizer.name.split(" ")[0] || "",
                                    organizer.name.split(" ")[1] || "",
                                    !!organizer.avatar
                                  )}
                                  className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                                />
                                <div className="flex-1">
                                  <div
                                    className={`font-medium text-gray-900 mb-1 ${
                                      isClickable
                                        ? "hover:text-blue-600 transition-colors"
                                        : ""
                                    }`}
                                  >
                                    {organizer.name}
                                    {organizer.userId === currentUserId && (
                                      <span className="ml-2 text-xs text-blue-600 font-normal">
                                        (You)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 mb-2">
                                    {organizer.role}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center text-sm text-gray-600">
                                  <Icon
                                    name="envelope"
                                    className="w-3.5 h-3.5 mr-3"
                                  />
                                  <a
                                    href={`mailto:${organizer.email}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {organizer.email}
                                  </a>
                                </div>
                                <div className="flex items-center text-sm text-gray-600">
                                  <Icon
                                    name="phone"
                                    className="w-3.5 h-3.5 mr-3"
                                  />
                                  <a
                                    href={`tel:${organizer.phone}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {organizer.phone}
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-700">No co-organizers listed.</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Online Meeting Link - Always visible to authenticated dashboard users */}
          {(event.format === "Online" ||
            event.format === "Hybrid Participation") &&
            event.zoomLink && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Online Meeting Link
                </h3>
                <a
                  href={event.zoomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                >
                  {event.zoomLink}
                </a>
              </div>
            )}

          {/* Meeting Details - Always visible to authenticated dashboard users */}
          {(event.format === "Online" ||
            event.format === "Hybrid Participation") &&
            (event.meetingId || event.passcode) && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Meeting Details
                </h3>
                <div className="space-y-1 text-gray-700">
                  {event.meetingId && (
                    <div className="flex items-center">
                      <span className="font-medium w-24">Meeting ID:</span>
                      <span className="font-mono">{event.meetingId}</span>
                    </div>
                  )}
                  {event.passcode && (
                    <div className="flex items-center">
                      <span className="font-medium w-24">Passcode:</span>
                      <span className="font-mono">{event.passcode}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Program Labels - Shows which programs this event belongs to */}
          {event.programLabels && event.programLabels.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Associated Programs
              </h3>
              <div className="flex flex-wrap gap-2">
                {event.programLabels.map((programId) => (
                  <button
                    key={programId}
                    onClick={() => navigate(`/dashboard/programs/${programId}`)}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4 mr-1.5"
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
                    {programNames[programId] || "Loading..."}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Requirements */}
          {event.requirements && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Requirements
              </h3>
              <p className="text-gray-700">{event.requirements}</p>
            </div>
          )}

          {/* Materials Needed */}
          {event.materials && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Materials Needed
              </h3>
              <p className="text-gray-700">{event.materials}</p>
            </div>
          )}

          {event.disclaimer && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Disclaimer
              </h3>
              <div
                className="text-gray-700"
                data-testid="event-detail-disclaimer"
              >
                <Multiline text={event.disclaimer} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User's Current Signup Status - Only show for upcoming events in normal mode */}
      {isUserSignedUp && !managementMode && !isPassedEvent && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Icon name="check-circle" className="w-5 h-5 text-green-600 mr-3" />
            <h3 className="text-sm font-medium text-green-800">
              You're signed up for {userSignedUpRoles.length} role
              {userSignedUpRoles.length !== 1 ? "s" : ""}:
            </h3>
          </div>
          <div className="ml-8 space-y-1">
            {userSignedUpRoles.map((role) => (
              <div key={role.id} className="text-sm text-green-700">
                <span className="font-medium">{role.name}</span> -{" "}
                <span className="whitespace-pre-line">{role.description}</span>
              </div>
            ))}
          </div>
          {!hasUnlimitedRoles(currentUser?.role) &&
            userSignedUpRoles.length < maxRolesForUser && (
              <p className="text-xs text-green-600 mt-2 ml-8">
                You can sign up for {maxRolesForUser - userSignedUpRoles.length}{" "}
                more role
                {maxRolesForUser - userSignedUpRoles.length !== 1 ? "s" : ""}.
                {currentUserRole === "Participant" && (
                  <span className="block mt-1 text-gray-600">
                    As a Participant, available roles depend on event type.
                  </span>
                )}
              </p>
            )}
          {hasUnlimitedRoles(currentUser?.role) && (
            <p className="text-xs text-green-600 mt-2 ml-8">
              As {currentUser?.role}, you can sign up for unlimited roles.
            </p>
          )}
        </div>
      )}

      {/* Maximum roles reached warning - Only show for upcoming events in normal mode */}
      {hasReachedMaxRoles && !managementMode && !isPassedEvent && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="tag" className="w-5 h-5 text-amber-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-amber-800">
                Maximum Roles Reached
              </h3>
              <p className="text-xs text-amber-600 mt-1">
                You have reached the maximum of {maxRolesForUser} roles for this
                event as {currentUser?.role}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completed Event Notice - Only show for passed events */}
      {isPassedEvent && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="check-circle" className="w-5 h-5 text-blue-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                This event has been completed.
              </h3>
              <p className="text-sm text-blue-600">
                This event took place on {formatDateToAmerican(event.date)} and
                had {event.attendees || event.signedUp} attendees. You can view
                the participant list below, but no changes can be made.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Event Notice */}
      {event.status === "cancelled" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <Icon name="tag" className="w-5 h-5 text-red-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                This event has been cancelled by the organizers.
              </h3>
              <p className="text-sm text-red-600">
                All participants have been notified of the cancellation. The
                event will be moved to past events after its scheduled time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Roles Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {isPassedEvent
            ? "Event Participants"
            : managementMode
            ? "Manage Event Sign-ups"
            : "Event Roles & Sign-up"}
        </h2>

        {/* Management Action Buttons - moved from header */}
        <div className="flex items-center space-x-3 mb-6">
          {isPassedEvent ? (
            /* For passed events, only show Export button for Super Admin, Administrators, and Organizers */
            currentUserRole === "Super Admin" ||
            currentUserRole === "Administrator" ||
            isCurrentUserOrganizer ? (
              <button
                onClick={handleExportSignups}
                className="inline-flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Export Data
              </button>
            ) : null
          ) : (
            /* For upcoming events, show management buttons for authorized users */
            canManageSignups && (
              <>
                <button
                  onClick={() => setManagementMode(!managementMode)}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    managementMode
                      ? "bg-gray-600 text-white hover:bg-gray-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {managementMode ? "Exit Management" : "Manage Sign-ups"}
                </button>
                <button
                  onClick={() =>
                    setEmailModal({
                      open: true,
                      subject: "",
                      bodyHtml: "",
                      includeUsers: true,
                      includeGuests: false,
                      sending: false,
                    })
                  }
                  className="px-4 py-2 rounded-md transition-colors bg-purple-600 text-white hover:bg-purple-700"
                >
                  Email Participants
                </button>
                {managementMode && (
                  <button
                    onClick={handleExportSignups}
                    className="inline-flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export Data
                  </button>
                )}
              </>
            )
          )}
        </div>

        {/* Workshop Group Topics Section */}
        <WorkshopGroupsSection
          event={event}
          isPassedEvent={isPassedEvent}
          canEditWorkshopGroup={canEditWorkshopGroup}
          editingGroup={editingGroup}
          topicDraft={topicDraft}
          setTopicDraft={setTopicDraft}
          startEditTopic={startEditTopic}
          saveTopic={saveTopic}
          cancelEditTopic={cancelEditTopic}
        />

        <EventRolesSection
          event={event}
          isPassedEvent={isPassedEvent}
          managementMode={managementMode}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          canNavigateToProfiles={canNavigateToProfiles}
          isCurrentUserOrganizer={isCurrentUserOrganizer}
          guestsByRole={guestsByRole}
          notification={notification}
          setCancelConfirm={setCancelConfirm}
          setEditGuest={setEditGuest}
          handleNameCardClick={handleNameCardClick}
          draggedUserId={draggedUserId}
          draggedGuestId={draggedGuestId}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleDragStart={handleDragStart}
          handleGuestDragStart={handleGuestDragStart}
          handleDragEnd={handleDragEnd}
          setEvent={setEvent}
          handleManagementCancel={handleManagementCancel}
          setResendLinkConfirm={setResendLinkConfirm}
          handleRoleSignup={handleRoleSignup}
          handleRoleCancel={handleRoleCancel}
          hasReachedMaxRoles={hasReachedMaxRoles}
          maxRolesForUser={maxRolesForUser}
          isRoleAllowedForUser={isRoleAllowedForUser}
          canManageSignups={canManageSignups}
        />
      </div>

      {/* All Event Modals */}
      {event && (
        <EventModals
          event={event}
          showDeletionModal={showDeletionModal}
          setShowDeletionModal={setShowDeletionModal}
          handleDeleteEvent={handleDeleteEvent}
          handleCancelEvent={handleCancelEvent}
          cancelConfirm={cancelConfirm}
          setCancelConfirm={setCancelConfirm}
          guestsByRole={guestsByRole}
          setGuestsByRole={setGuestsByRole}
          notification={notification}
          editGuest={editGuest}
          setEditGuest={setEditGuest}
          nameCardModal={nameCardModal}
          setNameCardModal={setNameCardModal}
          emailModal={emailModal}
          setEmailModal={setEmailModal}
          emailEditorRef={emailEditorRef}
          applyEditorCommand={applyEditorCommand}
          resendLinkConfirm={resendLinkConfirm}
          setResendLinkConfirm={setResendLinkConfirm}
          showShareModal={showShareModal}
          setShowShareModal={setShowShareModal}
        />
      )}
    </div>
  );
}
