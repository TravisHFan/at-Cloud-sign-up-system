import Multiline from "../components/common/Multiline";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import type { EventData, EventRole } from "../types/event";
import { Icon } from "../components/common";
import { getAvatarUrlWithCacheBust, getAvatarAlt } from "../utils/avatarUtils";
import { eventService } from "../services/api";
import GuestApi from "../services/guestApi";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { useAuth } from "../hooks/useAuth";
import { useAvatarUpdates } from "../hooks/useAvatarUpdates";
import { formatDateToAmerican } from "../utils/eventStatsUtils";
import { socketService, type EventUpdate } from "../services/socketService";
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
// For realtime auto-unpublish toast messaging
import {
  getMissingNecessaryFieldsForPublishFrontend,
  PUBLISH_FIELD_LABELS,
} from "../types/event";
import WorkshopGroupsSection from "../components/EventDetail/WorkshopGroupsSection";
import EventModals from "../components/EventDetail/EventModals";
import EventRolesSection from "../components/EventDetail/EventRolesSection";
import FlyerDisplay from "../components/EventDetail/FlyerDisplay";
import EventBasicDetails from "../components/EventDetail/EventBasicDetails";
import EventHostAndPurpose from "../components/EventDetail/EventHostAndPurpose";
import EventCapacityAndAgenda from "../components/EventDetail/EventCapacityAndAgenda";
import EventHeader from "../components/EventDetail/EventHeader";

// Backend event/role/user shapes for safe conversion without `any`
type BackendUser = {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  gender?: "male" | "female";
  systemAuthorizationLevel?: string;
  roleInAtCloud?: string;
};

type BackendRegistration = {
  user: BackendUser;
  notes?: string;
  registeredAt?: string;
};

type BackendRole = {
  id: string;
  name: string;
  description: string;
  maxParticipants: number;
  registrations?: BackendRegistration[];
  currentSignups?: EventRole["currentSignups"]; // legacy compatibility
};

type BackendEventLike = {
  id?: string;
  _id?: string;
  title: string;
  type: string;
  date: string;
  endDate?: string;
  time: string;
  endTime: string;
  timeZone?: string;
  location: string;
  organizer: string;
  hostedBy?: string;
  organizerDetails?: EventData["organizerDetails"];
  purpose?: string;
  agenda?: string;
  format: string;
  disclaimer?: string;
  roles: BackendRole[];
  signedUp?: number;
  totalSlots?: number;
  createdBy: EventData["createdBy"];
  createdAt: string;
  isHybrid?: boolean;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  requirements?: string;
  materials?: string;
  status?: "completed" | "cancelled" | "upcoming" | string;
  attendees?: number;
  workshopGroupTopics?: EventData["workshopGroupTopics"];
  flyerUrl?: string;
  secondaryFlyerUrl?: string;
};

type GuestApiGuest = {
  id?: string;
  _id?: string;
  roleId: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
};

type GuestDisplay = {
  id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
};

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
    canViewZoomInfo,
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

  // Set up real-time socket connection and event listeners
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token || !id) return;

    let isComponentMounted = true; // Track component mount state

    const initializeSocket = async () => {
      // Only proceed if component is still mounted
      if (!isComponentMounted) return;

      // Connect to socket service (only if not already connected)
      socketService.connect(token);

      // Join event room for real-time updates (now async)
      await socketService.joinEventRoom(id);
    };

    initializeSocket();

    // Handle event updates with current values
    const handleEventUpdate = async (updateData: EventUpdate) => {
      // Early return if component unmounted or wrong event
      if (!isComponentMounted || updateData.eventId !== id) return;

      console.log("📡 Real-time event update received:", updateData);

      // Keep admin guest list in sync on guest events without full refetch
      if (
        updateData.updateType === "guest_cancellation" ||
        updateData.updateType === "guest_declined" ||
        updateData.updateType === "guest_updated" ||
        updateData.updateType === "guest_registration" ||
        updateData.updateType === "guest_moved"
      ) {
        // guest_moved doesn't carry roleId/guestName; other guest_* do
        if (updateData.updateType !== "guest_moved") {
          const payloadUnknown: unknown = updateData.data;
          const { roleId, guestName } =
            typeof payloadUnknown === "object" && payloadUnknown !== null
              ? (payloadUnknown as { roleId?: string; guestName?: string })
              : ({} as { roleId?: string; guestName?: string });
          if (roleId && guestName) {
            setGuestsByRole((prev) => {
              const copy: typeof prev = { ...prev };
              const list = copy[roleId] ? [...copy[roleId]] : [];
              if (
                updateData.updateType === "guest_cancellation" ||
                updateData.updateType === "guest_declined"
              ) {
                copy[roleId] = list.filter((g) => g.fullName !== guestName);
              } else if (updateData.updateType === "guest_registration") {
                // optimistically add entry if not present (admin view lists guests by role)
                if (!list.find((g) => g.fullName === guestName)) {
                  list.push({
                    id: `${guestName}-${Date.now()}`,
                    fullName: guestName,
                  });
                }
                copy[roleId] = list;
              } else {
                // guest_updated: name or phone may change; best-effort update by name
                const idx = list.findIndex((g) => g.fullName === guestName);
                if (idx !== -1) {
                  list[idx] = { ...list[idx] };
                  copy[roleId] = list;
                }
              }
              return copy;
            });
          }
        }

        // Immediately refresh guests list from API to include contact info (email/phone)
        // Only for guest_registration and guest_updated; for cancellations, keep optimistic removal stable
        if (
          updateData.updateType === "guest_registration" ||
          updateData.updateType === "guest_updated" ||
          updateData.updateType === "guest_moved"
        ) {
          try {
            const data = await GuestApi.getEventGuests(id);
            const grouped: Record<string, GuestDisplay[]> = {};
            const guests = (data?.guests || []) as GuestApiGuest[];
            guests.forEach((g) => {
              const r = g.roleId;
              if (!grouped[r]) grouped[r] = [];
              grouped[r].push({
                id: g.id || g._id,
                fullName: g.fullName,
                email: g.email,
                phone: g.phone,
                notes: g.notes,
              });
            });
            setGuestsByRole(grouped);
          } catch {
            // Ignore if unauthorized or failed; optimistic update remains
          }
        }
      }

      // Update quickly with payload for instant UI feedback using typed unions
      const maybeEvent = (() => {
        switch (updateData.updateType) {
          case "user_signed_up":
          case "user_cancelled":
          case "user_removed":
          case "user_moved":
          case "user_assigned":
            return updateData.data.event;
          case "guest_moved":
            return updateData.data.event;
          default:
            return undefined;
        }
      })();

      if (maybeEvent) {
        const e = maybeEvent as BackendEventLike & {
          publish?: boolean;
          publicSlug?: string;
          publishedAt?: string;
        };
        setEvent((prev) => {
          const convertedEvent: EventData = {
            id: e.id || (e._id as string),
            title: e.title,
            type: e.type,
            date: e.date,
            endDate: e.endDate,
            time: e.time,
            endTime: e.endTime,
            timeZone: e.timeZone,
            location: e.location,
            organizer: e.organizer,
            hostedBy: e.hostedBy,
            organizerDetails: e.organizerDetails || [],
            purpose: e.purpose,
            agenda: e.agenda,
            format: e.format,
            disclaimer: e.disclaimer,
            flyerUrl: e.flyerUrl,
            secondaryFlyerUrl: e.secondaryFlyerUrl,
            roles: (e.roles || []).map((role: BackendRole) => {
              interface RoleWithPublic extends BackendRole {
                openToPublic?: boolean;
                capacityRemaining?: number;
              }
              const r = role as RoleWithPublic;
              return {
                id: role.id,
                name: role.name,
                description: role.description,
                maxParticipants: role.maxParticipants,
                openToPublic:
                  r.openToPublic ??
                  prev?.roles.find((pr) => pr.id === role.id)?.openToPublic,
                capacityRemaining: r.capacityRemaining,
                currentSignups: role.registrations
                  ? role.registrations.map((reg: BackendRegistration) => ({
                      userId: reg.user.id,
                      username: reg.user.username,
                      firstName: reg.user.firstName,
                      lastName: reg.user.lastName,
                      email: reg.user.email,
                      phone: reg.user.phone,
                      avatar: reg.user.avatar,
                      gender: reg.user.gender,
                      systemAuthorizationLevel:
                        (reg.user as { role?: string }).role ||
                        reg.user.systemAuthorizationLevel,
                      roleInAtCloud: reg.user.roleInAtCloud,
                      notes: reg.notes,
                      registeredAt: reg.registeredAt,
                    }))
                  : role.currentSignups || [],
              };
            }),
            signedUp:
              (e.roles || []).reduce(
                (sum: number, role: BackendRole) =>
                  sum +
                  (role.registrations?.length ||
                    role.currentSignups?.length ||
                    0),
                0
              ) || 0,
            totalSlots:
              (e.roles || []).reduce(
                (sum: number, role: BackendRole) =>
                  sum + (role.maxParticipants || 0),
                0
              ) || 0,
            createdBy: e.createdBy,
            createdAt: e.createdAt,
            isHybrid: e.isHybrid,
            zoomLink: e.zoomLink,
            meetingId: e.meetingId,
            passcode: e.passcode,
            requirements: e.requirements,
            materials: e.materials,
            status:
              e.status === "completed" || e.status === "cancelled"
                ? e.status
                : undefined,
            attendees: e.attendees,
            workshopGroupTopics: e.workshopGroupTopics || undefined,
            // Preserve publish metadata if omitted in the socket payload
            publish: e.publish ?? prev?.publish,
            publicSlug: e.publicSlug ?? prev?.publicSlug,
            publishedAt: e.publishedAt ?? prev?.publishedAt,
          };
          return convertedEvent;
        });
      }

      // Show notification based on update type - use currentUserId from component scope
      switch (updateData.updateType) {
        case "workshop_topic_updated": {
          const { group, topic, userId: actorId } = updateData.data;
          const grp = group as "A" | "B" | "C" | "D" | "E" | "F";
          setEvent((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              workshopGroupTopics: {
                ...(prev.workshopGroupTopics || {}),
                [grp]: topic,
              },
            };
          });
          if (actorId !== currentUserId) {
            notificationRef.current.info(`Group ${grp} topic updated`, {
              title: "Workshop Topic",
            });
          }
          break;
        }
        case "user_signed_up": {
          const { userId: uid, roleName } = updateData.data;
          if (uid !== currentUserId) {
            notificationRef.current.info(`Someone joined ${roleName}`, {
              title: "Event Updated",
            });
          }
          break;
        }
        case "user_cancelled": {
          const { userId: uid, roleName } = updateData.data;
          if (uid !== currentUserId) {
            notificationRef.current.info(`Someone left ${roleName}`, {
              title: "Event Updated",
            });
          }
          break;
        }
        case "role_rejected": {
          // Backend emits when a previously assigned user rejects the role via email token
          type RoleRejectedPayload = {
            userId?: string;
            roleName?: string;
            roleId?: string;
          };
          const dataUnknown: unknown = updateData.data;
          const payload: RoleRejectedPayload =
            typeof dataUnknown === "object" && dataUnknown !== null
              ? (dataUnknown as RoleRejectedPayload)
              : {};
          const roleName = payload.roleName || "a role";
          const uid = payload.userId;
          if (uid === currentUserId) {
            // This would only happen if user rejected from another tab; still give feedback
            notificationRef.current.info(`You rejected ${roleName}`, {
              title: "Role Rejected",
            });
          } else {
            notificationRef.current.info(`Someone rejected ${roleName}`, {
              title: "Event Updated",
            });
          }
          break;
        }
        case "user_removed": {
          const { userId: uid, roleName } = updateData.data;
          if (
            uid === currentUserId &&
            location.pathname === `/dashboard/event/${id}`
          ) {
            notificationRef.current.warning(
              `You were removed from ${roleName}`,
              {
                title: "Event Update",
              }
            );
          } else if (uid !== currentUserId) {
            notificationRef.current.info(
              `Someone was removed from ${roleName}`,
              {
                title: "Event Updated",
              }
            );
          }
          break;
        }
        case "user_moved": {
          const { userId: uid, fromRoleName, toRoleName } = updateData.data;
          if (
            uid === currentUserId &&
            location.pathname === `/dashboard/event/${id}`
          ) {
            notificationRef.current.info(
              `You were moved from ${fromRoleName} to ${toRoleName}`,
              { title: "Event Update" }
            );
          } else if (uid !== currentUserId) {
            notificationRef.current.info(`Someone was moved between roles`, {
              title: "Event Updated",
            });
          }
          break;
        }
        case "user_assigned": {
          const { userId: uid, roleName } = updateData.data;
          if (
            uid === currentUserId &&
            location.pathname === `/dashboard/event/${id}`
          ) {
            notificationRef.current.info(`You were assigned to ${roleName}`, {
              title: "Event Update",
            });
          }
          break;
        }
        case "guest_cancellation":
          notificationRef.current.info(`A guest cancelled their registration`, {
            title: "Event Updated",
          });
          break;
        case "guest_declined":
          notificationRef.current.info(`A guest declined an invitation`, {
            title: "Event Updated",
          });
          break;
        case "guest_registration":
          notificationRef.current.info(`A guest registered`, {
            title: "Event Updated",
          });
          break;
        case "guest_updated":
          notificationRef.current.info(`Guest details updated`, {
            title: "Event Updated",
          });
          break;
        case "guest_moved": {
          const { fromRoleName, toRoleName, fromRoleId, toRoleId } =
            updateData.data;
          notificationRef.current.info(
            `A guest was moved from ${fromRoleName || fromRoleId} to ${
              toRoleName || toRoleId
            }`,
            { title: "Event Updated" }
          );
          break;
        }
      }

      // Always refetch fresh event for viewer-specific privacy (ensures email/phone visibility is correct without page refresh)
      try {
        const fresh = (await eventService.getEvent(
          id
        )) as unknown as BackendEventLike & {
          publish?: boolean;
          publicSlug?: string;
          publishedAt?: string;
        };
        if (isComponentMounted) {
          setEvent((prev) => {
            const viewerScopedEvent: EventData = {
              id: fresh.id || fresh._id!,
              title: fresh.title,
              type: fresh.type,
              date: fresh.date,
              endDate: fresh.endDate,
              time: fresh.time,
              endTime: fresh.endTime,
              timeZone: fresh.timeZone,
              location: fresh.location,
              organizer: fresh.organizer,
              hostedBy: fresh.hostedBy,
              organizerDetails: fresh.organizerDetails || [],
              purpose: fresh.purpose,
              agenda: fresh.agenda,
              format: fresh.format,
              disclaimer: fresh.disclaimer,
              flyerUrl: fresh.flyerUrl,
              secondaryFlyerUrl: fresh.secondaryFlyerUrl,
              roles: fresh.roles.map((role: BackendRole) => {
                interface RoleWithPublic extends BackendRole {
                  openToPublic?: boolean;
                  capacityRemaining?: number;
                }
                const r = role as RoleWithPublic;
                return {
                  id: role.id,
                  name: role.name,
                  description: role.description,
                  maxParticipants: role.maxParticipants,
                  openToPublic:
                    r.openToPublic ??
                    prev?.roles.find((pr) => pr.id === role.id)?.openToPublic,
                  capacityRemaining: r.capacityRemaining,
                  currentSignups: role.registrations
                    ? role.registrations.map((reg: BackendRegistration) => ({
                        userId: reg.user.id,
                        username: reg.user.username,
                        firstName: reg.user.firstName,
                        lastName: reg.user.lastName,
                        email: reg.user.email,
                        phone: reg.user.phone,
                        avatar: reg.user.avatar,
                        gender: reg.user.gender,
                        systemAuthorizationLevel:
                          (reg.user as { role?: string }).role ||
                          reg.user.systemAuthorizationLevel,
                        roleInAtCloud: reg.user.roleInAtCloud,
                        notes: reg.notes,
                        registeredAt: reg.registeredAt,
                      }))
                    : role.currentSignups || [],
                };
              }),
              signedUp:
                fresh.roles?.reduce(
                  (sum: number, role: BackendRole) =>
                    sum +
                    (role.registrations?.length ||
                      role.currentSignups?.length ||
                      0),
                  0
                ) || 0,
              totalSlots:
                fresh.roles?.reduce(
                  (sum: number, role: BackendRole) =>
                    sum + (role.maxParticipants || 0),
                  0
                ) || 0,
              createdBy: fresh.createdBy,
              createdAt: fresh.createdAt,
              isHybrid: fresh.isHybrid,
              zoomLink: fresh.zoomLink,
              meetingId: fresh.meetingId,
              passcode: fresh.passcode,
              requirements: fresh.requirements,
              materials: fresh.materials,
              status:
                fresh.status === "completed" || fresh.status === "cancelled"
                  ? fresh.status
                  : undefined,
              attendees: fresh.attendees,
              workshopGroupTopics: fresh.workshopGroupTopics || undefined,
              publish: fresh.publish ?? prev?.publish,
              publicSlug: fresh.publicSlug ?? prev?.publicSlug,
              publishedAt: fresh.publishedAt ?? prev?.publishedAt,
              autoUnpublishedAt:
                (fresh as unknown as { autoUnpublishedAt?: string | null })
                  .autoUnpublishedAt ?? prev?.autoUnpublishedAt,
              autoUnpublishedReason:
                (fresh as unknown as { autoUnpublishedReason?: string | null })
                  .autoUnpublishedReason ?? prev?.autoUnpublishedReason,
            };
            // Detect auto-unpublish (published -> unpublished) with reason
            try {
              const wasPublished = prev?.publish;
              const nowPublished = viewerScopedEvent.publish;
              const reason = viewerScopedEvent.autoUnpublishedReason;
              if (
                wasPublished &&
                wasPublished === true &&
                nowPublished === false &&
                reason === "MISSING_REQUIRED_FIELDS"
              ) {
                // Build human readable missing fields using the helper (defensive: rely on current viewerScopedEvent values)
                const missing =
                  getMissingNecessaryFieldsForPublishFrontend(
                    viewerScopedEvent
                  );
                const readable = missing.map(
                  (m) => PUBLISH_FIELD_LABELS[m] || m
                );
                notificationRef.current.warning(
                  readable.length
                    ? `Event automatically unpublished: missing ${readable.join(
                        ", "
                      )}`
                    : "Event automatically unpublished due to missing required fields",
                  { title: "Auto-unpublished" }
                );
              }
            } catch {
              // Swallow detection errors silently (non-critical UX enhancement)
            }
            return viewerScopedEvent;
          });
        }
      } catch {
        // Ignore refetch failures for realtime; initial optimistic update already applied
      }
    };

    socketService.on("event_update", handleEventUpdate);

    // Cleanup on unmount
    return () => {
      isComponentMounted = false; // Mark component as unmounted
      socketService.off("event_update");
      // Use setTimeout to ensure cleanup happens after React StrictMode double cleanup
      setTimeout(() => {
        socketService.leaveEventRoom(id);
      }, 0);
    };
  }, [id, currentUserId, location.pathname]); // notification handled via ref to avoid unstable deps

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
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
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            <span className="text-gray-700">Checking access...</span>
          </div>
        </div>
      )}

      {/* Program Access Restriction Modal */}
      {showAccessModal && blockedProgramId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowAccessModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              {/* Lock Icon */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 mb-4">
                <svg
                  className="h-6 w-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Enrollment Required
              </h3>

              {/* Message */}
              <p className="text-gray-600 mb-6">
                This event is part of a paid program:{" "}
                <span className="font-semibold text-gray-900">
                  {blockedProgramName}
                </span>
                . Please enroll in the program to access this event.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    setShowAccessModal(false);
                    navigate(`/dashboard/programs/${blockedProgramId}/enroll`);
                  }}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Enroll Now
                </button>
                <button
                  onClick={() => {
                    setShowAccessModal(false);
                    navigate(`/dashboard/programs/${blockedProgramId}`);
                  }}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-white text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  View Program
                </button>
              </div>

              {/* Close button */}
              <button
                onClick={() => {
                  setShowAccessModal(false);
                  navigate("/dashboard/programs");
                }}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700"
              >
                Back to Programs
              </button>
            </div>
          </div>
        </div>
      )}

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
      <div className="bg-white rounded-lg shadow-sm p-6">
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

          {/* Online Meeting Link - Only visible to registered users */}
          {(event.format === "Online" ||
            event.format === "Hybrid Participation") &&
            event.zoomLink &&
            canViewZoomInfo() && (
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

          {/* Zoom Info Access Notice for Non-Registered Users */}
          {(event.format === "Online" ||
            event.format === "Hybrid Participation") &&
            event.zoomLink &&
            !canViewZoomInfo() && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Online Meeting Information
                </h3>
                <p className="text-blue-800">
                  Upon registration, the meeting link and event details will be
                  sent to you via email.
                </p>
              </div>
            )}

          {/* Meeting Details - Only visible to registered users */}
          {(event.format === "Online" ||
            event.format === "Hybrid Participation") &&
            (event.meetingId || event.passcode) &&
            canViewZoomInfo() && (
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
