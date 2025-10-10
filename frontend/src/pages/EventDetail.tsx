import Multiline from "../components/common/Multiline";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import type { EventData, EventRole } from "../types/event";
import EventRoleSignup from "../components/events/EventRoleSignup";
import {
  Icon,
  EventDeletionModal,
  ConfirmationModal,
} from "../components/common";
import GuestEditModal from "../components/common/GuestEditModal";
import NameCardActionModal from "../components/common/NameCardActionModal";
import { getAvatarUrl, getAvatarAlt } from "../utils/avatarUtils";
import { eventService } from "../services/api";
import GuestApi from "../services/guestApi";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import EditButton from "../components/common/EditButton";
import { useAuth } from "../hooks/useAuth";
import {
  formatDateToAmerican,
  formatEventDateTimeRangeInViewerTZ,
} from "../utils/eventStatsUtils";
import { socketService, type EventUpdate } from "../services/socketService";
import * as XLSX from "xlsx";
import { ShareModal } from "../components/share/ShareModal";
import { usePublishReadiness } from "../hooks/usePublishReadiness";
import { PublishGateBanner } from "../components/publish/PublishGateBanner";
import { apiUrl } from "../lib/apiClient";
// For realtime auto-unpublish toast messaging
import {
  getMissingNecessaryFieldsForPublishFrontend,
  PUBLISH_FIELD_LABELS,
} from "../types/event";

// Inline helper component for readiness messaging under the publish status box
function PublishReadinessInline({ event }: { event: EventData }) {
  const { missingLabels, isReady } = usePublishReadiness(event);
  const hasPublicRole = event.roles.some((r) => r.openToPublic);
  if (!hasPublicRole) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
        <Icon name="x-circle" className="w-4 h-4" />
        <span>Add at least one "Open to Public" role below to publish</span>
      </div>
    );
  }
  if (!isReady) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
        <Icon name="x-circle" className="w-4 h-4" />
        <span>
          Missing required field(s): {missingLabels.join(", ")} (publishing
          disabled)
        </span>
      </div>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
      <Icon name="check-circle" className="w-4 h-4" />
      <span>
        Ready to publish • {event.roles.filter((r) => r.openToPublic).length}{" "}
        public role(s)
      </span>
    </div>
  );
}

interface PublishActionButtonProps {
  event: EventData;
  publishing: boolean;
  setPublishing: (b: boolean) => void;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  notification: ReturnType<typeof useToastReplacement>;
  eventService: typeof import("../services/api").eventService;
}

function PublishActionButton({
  event,
  publishing,
  setPublishing,
  setEvent,
  notification,
  eventService,
}: PublishActionButtonProps) {
  const { isReady } = usePublishReadiness(event);
  const disabled =
    publishing ||
    (!event.publish && (!isReady || !event.roles.some((r) => r.openToPublic)));
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        if (disabled) return; // guard
        const isPublishingAction = !event.publish;
        try {
          setPublishing(true);
          const updated = isPublishingAction
            ? await eventService.publishEvent(event.id)
            : await eventService.unpublishEvent(event.id);
          const inferredPublish = isPublishingAction
            ? (updated as { publish?: boolean })?.publish ?? true
            : (updated as { publish?: boolean })?.publish ?? false;
          const nextPublishedAt = inferredPublish
            ? (updated as { publishedAt?: string })?.publishedAt ||
              event.publishedAt ||
              new Date().toISOString()
            : event.publishedAt;
          setEvent((prev) => {
            if (!prev)
              return {
                ...(updated as unknown as Record<string, unknown>),
                publish: inferredPublish,
                publishedAt: nextPublishedAt,
                roles: (updated as { roles?: unknown[] })?.roles || [],
              } as unknown as EventData;
            return {
              ...prev,
              publish: inferredPublish,
              publishedAt: nextPublishedAt,
              publicSlug:
                (updated as { publicSlug?: string })?.publicSlug ||
                prev.publicSlug,
            } as EventData;
          });
          notification.success(
            inferredPublish
              ? "Event published publicly."
              : "Event unpublished.",
            { title: inferredPublish ? "Published" : "Unpublished" }
          );
        } catch (e: unknown) {
          notification.error(
            e instanceof Error ? e.message : "Publish action failed",
            { title: "Action Failed" }
          );
        } finally {
          setPublishing(false);
        }
      }}
      className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm border transition-colors disabled:opacity-50 ${
        event.publish
          ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
      }`}
      title={!event.publish && !isReady ? "Missing required fields" : undefined}
      data-testid="publish-action-button"
    >
      {publishing ? "Working..." : event.publish ? "Unpublish" : "Publish"}
    </button>
  );
}

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
  // Keep a stable reference for notifications inside effects
  const notificationRef = useRef(notification);
  // Track previous publish state to detect auto-unpublish transitions via realtime updates/refetches
  const prevPublishRef = useRef<boolean | undefined>(undefined);
  const prevAutoReasonRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    notificationRef.current = notification;
  }, [notification]);
  const [event, setEvent] = useState<EventData | null>(null);
  // Publishing UI state
  const [publishing, setPublishing] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guestsByRole, setGuestsByRole] = useState<
    Record<string, GuestDisplay[]>
  >({});
  const [managementMode, setManagementMode] = useState(false);
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [draggedGuestId, setDraggedGuestId] = useState<string | null>(null);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  // Guest management modals
  const [cancelConfirm, setCancelConfirm] = useState<{
    open: boolean;
    roleId?: string;
    guest?: { id?: string; fullName: string; email?: string; phone?: string };
  }>({ open: false });
  const [editGuest, setEditGuest] = useState<{
    open: boolean;
    roleId?: string;
    guest?: { id?: string; fullName: string; email?: string; phone?: string };
  }>({ open: false });
  const [resendLinkConfirm, setResendLinkConfirm] = useState<{
    open: boolean;
    guestId?: string;
    guestName?: string;
  }>({ open: false });
  // Email participants modal state
  const [emailModal, setEmailModal] = useState<{
    open: boolean;
    subject: string;
    bodyHtml: string;
    includeUsers: boolean;
    includeGuests: boolean;
    sending: boolean;
  }>({
    open: false,
    subject: "",
    bodyHtml: "",
    includeUsers: true,
    includeGuests: false,
    sending: false,
  });
  const emailEditorRef = useRef<HTMLDivElement | null>(null);
  const savedSelection = useRef<Range | null>(null);
  // Initialize editor content only when opening to avoid caret jumping on every input
  useEffect(() => {
    if (emailModal.open && emailEditorRef.current) {
      emailEditorRef.current.innerHTML = emailModal.bodyHtml || "";
    }
    // Intentionally exclude emailModal.bodyHtml to prevent resetting caret on each keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailModal.open]);

  // Track and preserve selection within the editor so toolbar actions apply at caret
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      const editor = emailEditorRef.current;
      if (!sel || !editor || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (
        editor.contains(range.startContainer) &&
        editor.contains(range.endContainer)
      ) {
        savedSelection.current = range;
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const applyEditorCommand = (command: string, value?: string) => {
    const editor = emailEditorRef.current;
    if (!editor) return;
    // prevent losing caret and restore selection if available
    editor.focus();
    const sel = window.getSelection();
    if (savedSelection.current && sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedSelection.current);
      } catch {
        // ignore selection restoration errors
      }
    }
    document.execCommand(command, false, value);
    // sync state after command
    setEmailModal((m) => ({ ...m, bodyHtml: editor.innerHTML }));
  };
  // Workshop group topic editing state
  const [editingGroup, setEditingGroup] = useState<
    "A" | "B" | "C" | "D" | "E" | "F" | null
  >(null);
  const [topicDraft, setTopicDraft] = useState<string>("");

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

  // Use current user from auth context
  const currentUserId =
    currentUser?.id || "550e8400-e29b-41d4-a716-446655440000";
  const currentUserRole = currentUser?.role || "Super Admin";

  // Check if current user can navigate to other user profiles
  const canNavigateToProfiles =
    currentUserRole === "Super Admin" ||
    currentUserRole === "Administrator" ||
    currentUserRole === "Leader";

  // Check if current user is registered for this event
  const isCurrentUserRegistered = (): boolean => {
    if (!event || !currentUser) return false;

    // Check if user is registered in any role of the event
    return event.roles.some((role) =>
      role.currentSignups.some((signup) => signup.userId === currentUser.id)
    );
  };

  // Check if current user can view Zoom information
  const canViewZoomInfo = (): boolean => {
    if (!currentUser) return false;

    // Super Admin and Administrator can always see Zoom info
    if (
      currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator"
    ) {
      return true;
    }

    // Event organizers can always see Zoom info
    if (isCurrentUserOrganizer) {
      return true;
    }

    // Registered participants can see Zoom info
    return isCurrentUserRegistered();
  };

  // Get the correct profile link (matching Management page logic)
  const getProfileLink = (userId: string) => {
    return userId === currentUserId
      ? "/dashboard/profile" // Own profile page (editable)
      : `/dashboard/profile/${userId}`; // View-only profile page
  };

  // Handle name card click for authorized users
  const handleNameCardClick = (
    userId: string,
    userName?: string,
    userRole?: string
  ) => {
    // If clicking on self, always allow navigation to own profile
    if (userId === currentUserId) {
      navigate(getProfileLink(userId));
      return;
    }

    // Open action modal for other users
    setNameCardModal({
      isOpen: true,
      userId,
      userName: userName || "Unknown User",
      userRole: userRole || "",
    });
  };

  // Check if current user is an organizer of this event
  const isCurrentUserOrganizer =
    event &&
    // Check if user is in organizerDetails array
    (event.organizerDetails?.some(
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
        ));

  // Check if current user can delete this event (Administrator/Super Admin or Organizer)
  const canDeleteEvent =
    event &&
    (currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator" ||
      isCurrentUserOrganizer);

  // Check if this is a passed event
  const isPassedEvent = event?.status === "completed";

  // Check if current user can manage signups (Administrator/Super Admin or Organizer) - but not for passed events
  const canManageSignups =
    event &&
    !isPassedEvent &&
    (currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator" ||
      isCurrentUserOrganizer);

  // Universal role visibility: all roles are allowed for every user.
  const isRoleAllowedForUser = (_roleName: string): boolean => true;

  // Get all roles the user is signed up for
  const getUserSignupRoles = (): EventRole[] => {
    if (!event) return [];

    return event.roles.filter(
      (role) =>
        role.currentSignups?.some(
          (signup) => signup.userId === currentUserId
        ) ?? false
    );
  };

  // NEW POLICY (2025-09): Users can register for up to 3 distinct roles per event.
  const userSignedUpRoles = getUserSignupRoles();
  const maxRolesForUser = 3;
  const userDistinctRoleCount = event
    ? event.roles.reduce(
        (count, r) =>
          count +
          (r.currentSignups.some((s) => s.userId === currentUserId) ? 1 : 0),
        0
      )
    : 0;
  const hasReachedMaxRoles = userDistinctRoleCount >= maxRolesForUser;
  const isUserSignedUp = userSignedUpRoles.length > 0;

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        navigate("/dashboard");
        return;
      }

      try {
        setLoading(true);

        // Fetch event from backend API
        const eventData = (await eventService.getEvent(id)) as unknown as
          | BackendEventLike
          | undefined;

        // In certain test/dev environments (e.g., StrictMode double-invocation),
        // a mocked getEvent may resolve only once and return undefined on the second call.
        // Guard against undefined to avoid crashing and let the first successful
        // render stand.
        if (!eventData) {
          setLoading(false);
          return;
        }

        // Convert backend event data to frontend EventData format
        const convertedEvent: EventData = {
          id: eventData.id || eventData._id!,
          title: eventData.title,
          type: eventData.type,
          date: eventData.date,
          endDate: eventData.endDate,
          time: eventData.time,
          endTime: eventData.endTime,
          timeZone: eventData.timeZone,
          location: eventData.location,
          organizer: eventData.organizer,
          hostedBy: eventData.hostedBy,
          organizerDetails: eventData.organizerDetails || [],
          purpose: eventData.purpose,
          agenda: eventData.agenda,
          format: eventData.format,
          disclaimer: eventData.disclaimer,
          flyerUrl: eventData.flyerUrl,
          // Programs integration
          programId:
            (eventData as unknown as { programId?: string | null }).programId ??
            null,
          mentorCircle:
            (
              eventData as unknown as {
                mentorCircle?: "E" | "M" | "B" | "A" | null;
              }
            ).mentorCircle ?? null,
          mentors:
            (
              eventData as unknown as {
                mentors?: Array<{
                  userId: string;
                  name?: string;
                  email?: string;
                  gender?: "male" | "female";
                  avatar?: string | null;
                  roleInAtCloud?: string;
                }>;
              }
            ).mentors || [],
          roles: (eventData.roles || []).map((role: BackendRole) => {
            interface RoleWithPublicFields extends BackendRole {
              openToPublic?: boolean;
              capacityRemaining?: number;
            }
            const r = role as RoleWithPublicFields;
            return {
              id: role.id,
              name: role.name,
              description: role.description,
              agenda: (role as { agenda?: string }).agenda,
              maxParticipants: role.maxParticipants,
              openToPublic: r.openToPublic,
              capacityRemaining: r.capacityRemaining,
              // Convert new backend format (registrations) to frontend format (currentSignups)
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
            eventData.signedUp ||
            (eventData.roles || []).reduce(
              (sum: number, role: BackendRole) =>
                sum +
                (role.registrations?.length ||
                  role.currentSignups?.length ||
                  0),
              0
            ) ||
            0,
          totalSlots:
            eventData.totalSlots ||
            (eventData.roles || []).reduce(
              (sum: number, role: BackendRole) =>
                sum + (role.maxParticipants || 0),
              0
            ) ||
            0,
          createdBy: eventData.createdBy,
          createdAt: eventData.createdAt,
          isHybrid: eventData.isHybrid,
          zoomLink: eventData.zoomLink,
          meetingId: eventData.meetingId,
          passcode: eventData.passcode,
          requirements: eventData.requirements,
          materials: eventData.materials,
          status:
            eventData.status === "completed" || eventData.status === "cancelled"
              ? eventData.status
              : undefined,
          attendees: eventData.attendees,
          workshopGroupTopics: eventData.workshopGroupTopics || undefined,
          publish: (eventData as { publish?: boolean }).publish,
          publishedAt: (eventData as { publishedAt?: string }).publishedAt,
          publicSlug: (eventData as { publicSlug?: string }).publicSlug,
        };

        setEvent(convertedEvent);
        // After event is loaded, fetch guests for this event
        try {
          const data = await GuestApi.getEventGuests(convertedEvent.id);
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
          // Silently ignore if unauthorized or failed
          setGuestsByRole({});
        }
      } catch (error: unknown) {
        console.error("Error fetching event:", error);

        const message =
          error instanceof Error ? error.message : String(error ?? "");

        if (message.includes("not found") || message.includes("404")) {
          notificationRef.current.error(
            "The requested event could not be found. It may have been deleted or moved.",
            {
              title: "Event Not Found",
              actionButton: {
                text: "Browse Events",
                onClick: () => navigate("/dashboard"),
                variant: "primary",
              },
            }
          );
          setEvent(null);
        } else {
          notificationRef.current.error(
            "Unable to load event details. Please check your connection and try again.",
            {
              title: "Loading Failed",
              actionButton: {
                text: "Retry",
                onClick: () => window.location.reload(),
                variant: "primary",
              },
            }
          );
          navigate("/dashboard");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id, navigate]);

  // Helper to render guests for a role (admin or organizer)
  const renderGuestsForRole = (roleId: string) => {
    const list = guestsByRole[roleId] || [];
    if (list.length === 0) return null;
    const isAdminViewer =
      currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator" ||
      isCurrentUserOrganizer;
    // Only render for admins or event organizers/co-organizers
    if (!isAdminViewer) return null;
    return (
      <div className="mt-3 space-y-1" data-testid={`admin-guests-${roleId}`}>
        <h4 className="font-medium text-gray-700">Guests:</h4>
        <div className="space-y-2">
          {list.map((g, idx) => (
            <div
              key={g.id || idx}
              className="flex items-center justify-between p-3 rounded-md bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              data-testid={`admin-guest-${g.id || idx}`}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                  Guest
                </span>
                <span className="text-gray-900 font-medium">{g.fullName}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-500">
                  {g.email && <span className="mr-3">{g.email}</span>}
                  {g.phone && <span>{g.phone}</span>}
                </div>
                {isAdminViewer && g.id && (
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                      onClick={async () => {
                        const confirm = window.confirm(
                          "Send a fresh manage link to this guest via email?"
                        );
                        if (!confirm) return;
                        try {
                          await GuestApi.resendManageLink(g.id!, {
                            eventId: event?.id,
                          });
                          notification.success("Manage link sent to guest.", {
                            title: "Email Sent",
                          });
                        } catch (e: unknown) {
                          const message =
                            e instanceof Error
                              ? e.message
                              : "Failed to send manage link.";
                          notification.error(message, { title: "Send Failed" });
                        }
                      }}
                    >
                      Re-send manage link
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600"
                      onClick={() => {
                        setCancelConfirm({ open: true, roleId, guest: g });
                      }}
                    >
                      Cancel Guest
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700"
                      onClick={() => {
                        setEditGuest({ open: true, roleId, guest: g });
                      }}
                    >
                      Edit Guest
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
                reason === "MISSING_REQUIRED_FIELDS" &&
                // Avoid duplicate toasts if we already showed for this reason state
                !(
                  prevPublishRef.current === false &&
                  prevAutoReasonRef.current === reason
                )
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
              prevPublishRef.current = viewerScopedEvent.publish;
              prevAutoReasonRef.current =
                viewerScopedEvent.autoUnpublishedReason;
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

  // Helper function to download calendar file
  const handleDownloadCalendar = async () => {
    if (!event) return;

    try {
      const response = await fetch(apiUrl(`/events/${event.id}/calendar`));
      if (!response.ok) {
        throw new Error("Failed to download calendar file");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading calendar file:", error);
      notification.error(
        "Failed to download calendar file. Please try again.",
        {
          title: "Download Failed",
        }
      );
    }
  };

  const handleRoleSignup = async (roleId: string, notes?: string) => {
    if (!event || !currentUser) return;

    try {
      // Call backend API to sign up for event
      const updatedEvent = await eventService.signUpForEvent(
        event.id,
        roleId,
        notes
      );

      // Convert backend response to frontend format and update state
      const convertedEvent: EventData = {
        ...event,
        roles: updatedEvent.roles.map((role: BackendRole) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          agenda: (role as { agenda?: string }).agenda,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
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
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: BackendRole) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      setEvent(convertedEvent);

      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      notification.success(`You have successfully signed up for ${roleName}!`, {
        title: "Signup Confirmed",
        autoCloseDelay: 4000,
        closeButtonText: "Close",
        actionButtons: [
          {
            text: "Add to Calendar",
            onClick: handleDownloadCalendar,
            variant: "primary",
          },
          {
            text: "View My Signups",
            onClick: () => navigate("/dashboard/my-events"),
            variant: "secondary",
          },
        ],
      });
    } catch (error: unknown) {
      console.error("Error signing up for role:", error);
      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      const message =
        error instanceof Error
          ? error.message
          : `Unable to sign up for ${roleName}. Please try again.`;
      notification.error(message, {
        title: "Signup Failed",
        actionButton: {
          text: "Retry Signup",
          onClick: () => handleRoleSignup(roleId),
          variant: "primary",
        },
      });
    }
  };

  // Permission checks for editing workshop topics
  const canEditWorkshopGroup = (
    group: "A" | "B" | "C" | "D" | "E" | "F"
  ): boolean => {
    if (!event || !currentUser) return false;
    const userRole = currentUser.role;
    if (userRole === "Super Admin" || userRole === "Administrator") return true;
    // Event initiator (createdBy matches currentUser.id)
    if (event.createdBy === currentUser.id) return true;
    // Listed co-organizers in organizerDetails
    if (event.organizerDetails?.some((o) => o.userId === currentUser.id))
      return true;
    // Registered Group {X} Leader
    const leaderRoleName = `Group ${group} Leader`;
    return event.roles.some(
      (role) =>
        role.name === leaderRoleName &&
        role.currentSignups.some((s) => s.userId === currentUser.id)
    );
  };

  const startEditTopic = (group: "A" | "B" | "C" | "D" | "E" | "F") => {
    if (!event) return;
    setEditingGroup(group);
    const current = event.workshopGroupTopics?.[group] || "";
    setTopicDraft(current);
  };

  const cancelEditTopic = () => {
    setEditingGroup(null);
    setTopicDraft("");
  };

  const saveTopic = async () => {
    if (!event || !editingGroup) return;
    try {
      const updated = await eventService.updateWorkshopGroupTopic(
        event.id,
        editingGroup,
        topicDraft.trim()
      );
      // Merge back minimal parts we need
      setEvent((prev) => {
        if (!prev) return prev;
        const converted: EventData = {
          ...prev,
          // keep previous roles mapping; backend returns full event, but we only need topics here
          workshopGroupTopics: updated.workshopGroupTopics || {
            ...(prev.workshopGroupTopics || {}),
            [editingGroup]: topicDraft.trim(),
          },
        };
        return converted;
      });
      notification.success(`Saved topic for Group ${editingGroup}.`, {
        title: "Workshop Topic",
      });
      setEditingGroup(null);
      setTopicDraft("");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save topic.";
      notification.error(message, {
        title: "Workshop Topic",
      });
    }
  };

  const handleRoleCancel = async (roleId: string) => {
    if (!event || !currentUser) return;

    try {
      // Call backend API to cancel event signup
      const updatedEvent = await eventService.cancelSignup(event.id, roleId);

      // Convert backend response to frontend format and update state
      const convertedEvent: EventData = {
        ...event,
        roles: updatedEvent.roles.map((role: BackendRole) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          agenda: (role as { agenda?: string }).agenda,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
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
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: BackendRole) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      setEvent(convertedEvent);

      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      notification.success(`Your signup for ${roleName} has been canceled.`, {
        title: "Signup Canceled",
        autoCloseDelay: 4000,
        closeButtonText: "OK",
        actionButton: {
          text: "Undo Cancel",
          onClick: () => handleRoleSignup(roleId),
          variant: "secondary",
        },
      });
    } catch (error: unknown) {
      console.error("Error canceling role signup:", error);
      const roleName =
        event.roles.find((role) => role.id === roleId)?.name || "role";
      const message =
        error instanceof Error
          ? error.message
          : `Unable to cancel signup for ${roleName}. Please try again.`;
      notification.error(message, {
        title: "Cancel Failed",
        actionButton: {
          text: "Retry Cancel",
          onClick: () => handleRoleCancel(roleId),
          variant: "primary",
        },
      });
    }
  };

  // Management function to cancel any user's signup
  const handleManagementCancel = async (roleId: string, userId: string) => {
    if (!event) return;

    try {
      // Get user info for notification before removal
      const roleIndex = event.roles.findIndex((role) => role.id === roleId);
      const user = event.roles[roleIndex]?.currentSignups?.find(
        (signup) => signup.userId === userId
      );
      const roleName = event.roles[roleIndex]?.name;

      // Call real API endpoint
      const updatedEvent = await eventService.removeUserFromRole(
        event.id,
        userId,
        roleId
      );

      // Convert backend response to frontend format and update state
      const convertedEvent: EventData = {
        ...event,
        roles: updatedEvent.roles.map((role: BackendRole) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          agenda: (role as { agenda?: string }).agenda,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
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
        })),
        signedUp:
          updatedEvent.signedUp ||
          updatedEvent.roles?.reduce(
            (sum: number, role: BackendRole) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      // Update local state with converted data
      setEvent(convertedEvent);

      notification.success(
        `${user?.firstName} ${user?.lastName} has been removed from ${roleName}.`,
        {
          title: "User Removed",
          autoCloseDelay: 4000,
          closeButtonText: "OK",
          actionButton: {
            text: "Undo Removal",
            onClick: () => {
              // Simple undo - just reload the event data
              window.location.reload();
            },
            variant: "secondary",
          },
        }
      );
    } catch (error) {
      console.error("Error removing user from role:", error);
      notification.error("Unable to remove user from role. Please try again.", {
        title: "Removal Failed",
        actionButton: {
          text: "Retry",
          onClick: () => handleManagementCancel(roleId, userId),
          variant: "primary",
        },
      });
    }
  };

  // Drag and drop functionality
  const handleDragStart = (
    e: React.DragEvent,
    userId: string,
    fromRoleId: string
  ) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ userId, fromRoleId, type: "user" })
    );
    e.dataTransfer.effectAllowed = "move";
    setDraggedUserId(userId);
    setDraggedGuestId(null);
  };

  const handleGuestDragStart = (
    e: React.DragEvent,
    guestId: string,
    fromRoleId: string
  ) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ guestId, fromRoleId, type: "guest" })
    );
    e.dataTransfer.effectAllowed = "move";
    setDraggedGuestId(guestId);
    setDraggedUserId(null);
  };

  const handleDragEnd = () => {
    setDraggedUserId(null);
    setDraggedGuestId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, toRoleId: string) => {
    e.preventDefault();
    setDraggedUserId(null);
    setDraggedGuestId(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      const { userId, guestId, fromRoleId, type } = data;

      if (fromRoleId === toRoleId) {
        return; // Same role, no action needed
      }

      if (!event) return;

      // Check if target role has space
      const toRole = event.roles.find((role) => role.id === toRoleId);
      if (!toRole) return;

      if ((toRole.currentSignups?.length || 0) >= toRole.maxParticipants) {
        notification.error(
          `${toRole.name} is already full and cannot accept more participants.`,
          {
            title: "Role Full",
            autoCloseDelay: 4000,
          }
        );
        return;
      }

      // Find the user/guest to move
      const fromRole = event.roles.find((role) => role.id === fromRoleId);
      if (!fromRole) return;

      let updatedEvent: { roles: BackendRole[]; signedUp?: number } | undefined;
      if (type === "guest") {
        // Optimistic UI update for admin guest list map (guestsByRole)
        if (guestId) {
          const prevFrom = guestsByRole[fromRoleId] || [];
          const prevTo = guestsByRole[toRoleId] || [];
          const moving = prevFrom.find((g) => (g.id || "") === guestId);
          if (moving) {
            setGuestsByRole((prev) => {
              const copy: typeof prev = { ...prev };
              copy[fromRoleId] = prevFrom.filter(
                (g) => (g.id || "") !== guestId
              );
              copy[toRoleId] = [...prevTo, { ...moving }];
              return copy;
            });
          }
        }
        updatedEvent = (await eventService.moveGuestBetweenRoles(
          event.id,
          guestId,
          fromRoleId,
          toRoleId
        )) as unknown as { roles: BackendRole[]; signedUp?: number };
      } else {
        const userToMove = fromRole.currentSignups?.find(
          (signup) => signup.userId === userId
        );
        if (!userToMove) return;
        // Call real API endpoint
        updatedEvent = (await eventService.moveUserBetweenRoles(
          event.id,
          userId,
          fromRoleId,
          toRoleId
        )) as unknown as { roles: BackendRole[]; signedUp?: number };
      }

      // Convert backend response to frontend format and update state
      const convertedEvent: EventData = {
        ...event,
        roles: (updatedEvent?.roles || []).map((role: BackendRole) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          maxParticipants: role.maxParticipants,
          // Convert new backend format (registrations) to frontend format (currentSignups)
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
        })),
        signedUp:
          updatedEvent?.signedUp ||
          updatedEvent?.roles?.reduce(
            (sum: number, role: BackendRole) =>
              sum +
              (role.registrations?.length || role.currentSignups?.length || 0),
            0
          ) ||
          0,
      };

      // Update local state with converted data
      setEvent(convertedEvent);

      notification.success(
        type === "guest"
          ? `Guest moved from ${fromRole.name} to ${toRole.name}.`
          : `${
              fromRole.currentSignups?.find((s) => s.userId === userId)
                ? `${
                    fromRole.currentSignups?.find((s) => s.userId === userId)
                      ?.firstName
                  } ${
                    fromRole.currentSignups?.find((s) => s.userId === userId)
                      ?.lastName
                  }`
                : "User"
            } has been moved from ${fromRole.name} to ${toRole.name}.`,
        {
          title: "User Moved",
          autoCloseDelay: 4000,
          closeButtonText: "OK",
          actionButton: {
            text: "Refresh Event",
            onClick: () => window.location.reload(),
            variant: "secondary",
          },
        }
      );
    } catch (error) {
      console.error("Error moving user:", error);
      notification.error(
        "Unable to move participant between roles. Please try again.",
        {
          title: "Move Failed",
          actionButton: {
            text: "Refresh",
            onClick: () => window.location.reload(),
            variant: "primary",
          },
        }
      );
    }
  };

  // Export signups to Excel
  const handleExportSignups = () => {
    if (!event) return;

    // Prepare data for export
    const exportData: Array<Record<string, string | number | undefined>> = [];

    event.roles.forEach((role) => {
      role.currentSignups?.forEach((signup) => {
        exportData.push({
          "First Name": signup.firstName || "",
          "Last Name": signup.lastName || "",
          Username: signup.username,
          "System Authorization Level": signup.systemAuthorizationLevel || "",
          "Role in @Cloud": signup.roleInAtCloud || "",
          Gender: signup.gender || "",
          "Event Role": role.name,
          "Role Description": role.description,
          "Signup Notes": signup.notes || "",
          "User ID": signup.userId,
        });
      });
    });

    if (exportData.length === 0) {
      notification.warning(
        "There are currently no signups to export for this event.",
        {
          title: "No Data to Export",
          autoCloseDelay: 4000,
        }
      );
      return;
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();

    // Convert data to worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Event Signups");

    // Generate filename with current date
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    const filename = `${event.title.replace(
      /\s+/g,
      "_"
    )}_signups_${today}.xlsx`;

    // Write and download the file
    XLSX.writeFile(wb, filename);

    notification.success(
      `Successfully exported signup data for ${exportData.length} participants.`,
      {
        title: "Export Complete",
        autoCloseDelay: 4000,
        actionButton: {
          text: "Export Again",
          onClick: () => handleExportSignups(),
          variant: "secondary",
        },
      }
    );
  };

  // Handle event deletion
  const handleDeleteEvent = async () => {
    if (!event) return;

    try {
      // Call the actual backend API to delete the event
      await eventService.deleteEvent(event.id);

      notification.success(
        `"${event.title}" has been permanently deleted from the system.`,
        {
          title: "Event Deleted",
          autoCloseDelay: 3000,
          actionButton: {
            text: "Browse Events",
            onClick: () => navigate("/dashboard/upcoming"),
            variant: "primary",
          },
        }
      );

      // Navigate back to upcoming events
      navigate("/dashboard/upcoming");
    } catch (error: unknown) {
      console.error("Error deleting event:", error);

      // Handle specific error cases
      let errorMessage =
        "Unable to delete the event. Please try again or contact support.";
      let errorTitle = "Deletion Failed";

      const message = error instanceof Error ? error.message : "";

      if (message.includes("participants")) {
        errorMessage =
          "Cannot delete event with registered participants. Please remove all participants first.";
        errorTitle = "Event Has Participants";
      } else if (message.includes("permissions")) {
        errorMessage =
          "You don't have permission to delete this event. Only event organizers or administrators can delete events.";
        errorTitle = "Permission Denied";
      } else if (message.includes("not found")) {
        errorMessage =
          "This event has already been deleted or no longer exists.";
        errorTitle = "Event Not Found";
      }

      notification.error(errorMessage, {
        title: errorTitle,
        actionButton: {
          text:
            errorTitle === "Event Not Found" ? "Browse Events" : "Retry Delete",
          onClick: () => {
            if (errorTitle === "Event Not Found") {
              navigate("/dashboard");
            } else {
              handleDeleteEvent();
            }
          },
          variant: "primary",
        },
      });
    }
  };

  // Handle event cancellation
  const handleCancelEvent = async () => {
    if (!event) return;

    try {
      // Call the backend API to update event status to cancelled
      await eventService.updateEvent(event.id, {
        status: "cancelled",
        // Include organizerDetails to satisfy UpdateEventPayload contract
        organizerDetails: event.organizerDetails ?? [],
      });

      // Update local state to mark as cancelled
      const updatedEvent = { ...event, status: "cancelled" as const };
      setEvent(updatedEvent);

      notification.success(
        `"${event.title}" has been cancelled. All participants will be notified automatically.`,
        {
          title: "Event Cancelled",
          autoCloseDelay: 5000,
          actionButton: {
            text: "Undo Cancel",
            onClick: async () => {
              try {
                // Call API to revert cancellation
                await eventService.updateEvent(event.id, {
                  status: "upcoming",
                  // Include organizerDetails to satisfy UpdateEventPayload contract
                  organizerDetails: event.organizerDetails ?? [],
                });
                // Update local state deterministically without any-cast/delete
                // EventData.status does not include "upcoming"; undefined reverts to default behavior
                setEvent((prev) =>
                  prev ? { ...prev, status: undefined } : prev
                );
                notification.success("Event cancellation has been reverted.", {
                  title: "Cancellation Reverted",
                  autoCloseDelay: 3000,
                });
              } catch (error) {
                console.error("Error reverting cancellation:", error);
                notification.error("Failed to revert event cancellation.", {
                  title: "Revert Failed",
                });
              }
            },
            variant: "secondary",
          },
        }
      );

      // Close management mode if open
      setManagementMode(false);
    } catch (error: unknown) {
      console.error("Error cancelling event:", error);

      // Handle specific error cases
      let errorMessage =
        "Unable to cancel the event. Please try again or contact support.";
      let errorTitle = "Cancellation Failed";
      const message = error instanceof Error ? error.message : "";

      if (message.includes("permissions")) {
        errorMessage =
          "You don't have permission to cancel this event. Only event organizers or administrators can cancel events.";
        errorTitle = "Permission Denied";
      } else if (message.includes("not found")) {
        errorMessage = "This event no longer exists.";
        errorTitle = "Event Not Found";
      }

      notification.error(errorMessage, {
        title: errorTitle,
        actionButton: {
          text:
            errorTitle === "Event Not Found" ? "Browse Events" : "Retry Cancel",
          onClick: () => {
            if (errorTitle === "Event Not Found") {
              navigate("/dashboard");
            } else {
              handleCancelEvent();
            }
          },
          variant: "primary",
        },
      });
    }
  };

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
      {/* Event Header */}
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
          <div className="mb-6">
            {!event.publish && (
              <PublishGateBanner event={event} className="mb-4" />
            )}
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
                    First published{" "}
                    {new Date(event.publishedAt).toLocaleString()}
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
                  Public Roles (
                  {event.roles.filter((r) => r.openToPublic).length} of{" "}
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
        )}

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
            onClick={async () => {
              try {
                const response = await fetch(
                  `/api/events/${event.id}/calendar`
                );
                if (!response.ok) {
                  throw new Error("Failed to download calendar file");
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `${event.title.replace(
                  /[^a-zA-Z0-9]/g,
                  "_"
                )}.ics`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (error) {
                console.error("Error downloading calendar file:", error);
                // You could add a toast notification here if you have one
              }
            }}
            className="inline-flex items-center px-4 py-2 border border-blue-600 shadow-sm text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors h-10"
          >
            <Icon name="calendar" className="h-4 w-4 mr-1.5" />
            Add to Calendar
          </button>
        </div>

        {/* Event Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center text-gray-600 w-full col-span-1 md:col-span-2 lg:col-span-3">
            <Icon name="calendar" className="w-5 h-5 mr-3 flex-shrink-0" />
            <span>
              {formatEventDateTimeRangeInViewerTZ(
                event.date,
                event.time,
                event.endTime,
                event.timeZone,
                event.endDate
              )}
            </span>
            {event.timeZone ? (
              <span className="ml-2 text-xs text-gray-500">
                (shown in your local time)
              </span>
            ) : null}
          </div>
          <div className="flex items-center text-gray-600">
            <Icon name="map-pin" className="w-5 h-5 mr-3" />
            {event.location}
          </div>
          <div className="flex items-center text-gray-600">
            <Icon name="tag" className="w-5 h-5 mr-3" />
            Format: {event.format}
          </div>
          {/* Event Type */}
          <div className="flex items-center text-gray-600">
            <Icon name="check-circle" className="w-5 h-5 mr-3" />
            Type: {event.type || "No Type"}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Hosted by
            </h3>
            <div className="flex items-center text-gray-700">
              <img
                src="/Cloud-removebg.png"
                alt="@Cloud Logo"
                className="h-6 w-auto mr-2 object-contain"
              />
              {event.hostedBy || "@Cloud Marketplace Ministry"}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Purpose
            </h3>
            {event.purpose ? (
              // Preserve user-authored line breaks similarly to public event page
              <div className="text-gray-700" data-testid="event-detail-purpose">
                <Multiline text={event.purpose} />
              </div>
            ) : (
              <p className="text-gray-500">No purpose provided.</p>
            )}
          </div>

          {/* Description removed */}

          {/* Event Capacity */}
          {event.totalSlots && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Event Capacity
              </h3>
              <div className="flex items-center text-gray-700">
                <Icon name="user" className="w-5 h-5 mr-2" />
                <span>
                  {event.totalSlots} total slots available
                  {event.signedUp !== undefined && (
                    <span className="text-gray-500 ml-2">
                      ({event.signedUp} currently signed up)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Event Flyer (optional) */}
          {event.flyerUrl && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Event Flyer
              </h3>
              <div className="flex">
                <img
                  src={event.flyerUrl}
                  alt="Event flyer"
                  className="w-full max-w-2xl h-auto rounded border border-gray-200 object-contain"
                />
              </div>
            </div>
          )}

          {/* Event Agenda and Schedule */}
          {event.agenda && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Event Agenda and Schedule
              </h3>
              <div className="text-gray-700 whitespace-pre-line">
                {event.agenda}
              </div>
            </div>
          )}

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
                              src={getAvatarUrl(
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
                                  src={getAvatarUrl(
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

          {/* Mentors snapshot (Programs) */}
          {Array.isArray(event.mentors) && event.mentors.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Mentors{" "}
                {event.mentorCircle ? `(Circle ${event.mentorCircle})` : ""}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {event.mentors.map((m, idx) => (
                  <div
                    key={`${m.userId}-${idx}`}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-start space-x-3"
                  >
                    <img
                      src={getAvatarUrl(
                        m.avatar || null,
                        (m.gender as "male" | "female" | undefined) || "male"
                      )}
                      alt={getAvatarAlt(
                        (m.name ? m.name.split(" ")[0] : "") || "",
                        (m.name ? m.name.split(" ")[1] : "") || "",
                        !!m.avatar
                      )}
                      className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {m.name || "Mentor"}
                      </div>
                      {m.roleInAtCloud && (
                        <div className="text-sm text-gray-600">
                          {m.roleInAtCloud}
                        </div>
                      )}
                      {m.email && (
                        <div className="text-sm text-gray-600 mt-1">
                          <a
                            href={`mailto:${m.email}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {m.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
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
          {userSignedUpRoles.length < maxRolesForUser && (
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
                event.
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
        {event.type === "Effective Communication Workshop" && (
          <div className="mb-8 border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Group Practice Topics
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Each group can have a topic. Editable by Super Admin,
              Administrator, event initiator, co-organizers, and the registered
              Group Leader for that group.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(["A", "B", "C", "D", "E", "F"] as const).map((g) => {
                const topic = event.workshopGroupTopics?.[g] || "";
                const canEdit = canEditWorkshopGroup(g);
                const isEditing = editingGroup === g;
                return (
                  <div
                    key={g}
                    className="bg-white border border-gray-200 rounded-md p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900">Group {g}</div>
                      {canEdit &&
                        !isPassedEvent &&
                        (isEditing ? (
                          <div className="space-x-2">
                            <button
                              onClick={saveTopic}
                              className="px-2 py-1 text-sm bg-blue-600 text-white rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditTopic}
                              className="px-2 py-1 text-sm bg-gray-200 text-gray-800 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditTopic(g)}
                            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            Edit
                          </button>
                        ))}
                    </div>
                    {isEditing ? (
                      <textarea
                        value={topicDraft}
                        onChange={(e) => setTopicDraft(e.target.value)}
                        className="w-full border border-gray-300 rounded p-2 text-sm"
                        rows={3}
                        maxLength={200}
                        placeholder={`Enter topic for Group ${g} (max 200 chars)`}
                      />
                    ) : (
                      <div className="text-sm text-gray-700 min-h-[3rem] whitespace-pre-wrap">
                        {topic ? (
                          topic
                        ) : (
                          <span className="text-gray-400">No topic set</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isPassedEvent ? (
          /* Completed Event - Read-only participant view */
          <div className="space-y-6">
            {event.roles.map((role) => (
              <div key={role.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {role.name}
                    </h3>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {role.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {role.currentSignups.length} / {role.maxParticipants}{" "}
                      participants
                      {role.currentSignups.length >= role.maxParticipants && (
                        <span className="text-green-600 ml-1">(Full)</span>
                      )}
                    </p>
                  </div>
                </div>

                {role.currentSignups.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-700 mb-2">
                      Participants:
                    </h4>
                    {role.currentSignups.map((signup) => {
                      const isClickable =
                        canNavigateToProfiles ||
                        signup.userId === currentUserId;

                      // Show contact information to all logged-in users
                      // (simplified from old group-based Workshop logic)
                      const showContact = true;

                      // Ensure the current viewer sees their correct System Authorization Level
                      const displaySystemLevel =
                        signup.userId === currentUserId &&
                        currentUserRole !== "Participant" &&
                        (!signup.systemAuthorizationLevel ||
                          signup.systemAuthorizationLevel === "Participant")
                          ? currentUserRole
                          : signup.systemAuthorizationLevel;

                      return (
                        <div
                          key={signup.userId}
                          className={`flex items-center justify-between p-3 rounded-md bg-white border border-gray-200 ${
                            isClickable
                              ? "cursor-pointer hover:bg-gray-50 transition-colors"
                              : ""
                          }`}
                          onClick={() => {
                            if (isClickable) {
                              handleNameCardClick(
                                signup.userId,
                                `${signup.firstName} ${signup.lastName}`,
                                signup.roleInAtCloud
                              );
                            }
                          }}
                          title={
                            isClickable
                              ? `View ${signup.firstName} ${signup.lastName}'s profile`
                              : undefined
                          }
                        >
                          <div className="flex items-center space-x-3">
                            <img
                              src={getAvatarUrl(
                                signup.avatar || null,
                                signup.gender || "male"
                              )}
                              alt={getAvatarAlt(
                                signup.firstName || "",
                                signup.lastName || "",
                                !!signup.avatar
                              )}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                            <div>
                              <div className="font-medium text-gray-900">
                                {signup.firstName} {signup.lastName}
                                {signup.userId === currentUserId && (
                                  <span className="ml-2 text-xs text-blue-600 font-normal">
                                    (You)
                                  </span>
                                )}
                              </div>
                              {/* Display both system authorization level and role in @Cloud */}
                              <div className="text-sm text-gray-600 space-y-0.5">
                                {displaySystemLevel && (
                                  <div>
                                    System Authorization Level:{" "}
                                    {displaySystemLevel}
                                  </div>
                                )}
                                {signup.roleInAtCloud && (
                                  <div>
                                    Role in @Cloud: {signup.roleInAtCloud}
                                  </div>
                                )}
                              </div>
                              {signup.notes && (
                                <div className="text-xs text-gray-500 mt-1">
                                  "{signup.notes}"
                                </div>
                              )}
                            </div>
                          </div>
                          {showContact && (
                            <div className="mt-2 text-xs text-gray-600 space-y-1">
                              {signup.email && (
                                <div className="flex items-center gap-2">
                                  <Icon
                                    name="envelope"
                                    className="w-3 h-3 text-gray-500"
                                  />
                                  <a
                                    className="text-blue-600 hover:underline"
                                    href={`mailto:${signup.email}`}
                                  >
                                    {signup.email}
                                  </a>
                                </div>
                              )}
                              {signup.phone && signup.phone.trim() !== "" && (
                                <div className="flex items-center gap-2">
                                  <Icon
                                    name="phone"
                                    className="w-3 h-3 text-gray-500"
                                  />
                                  <a
                                    className="text-blue-600 hover:underline"
                                    href={`tel:${signup.phone}`}
                                  >
                                    {signup.phone}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm p-4 border-2 border-dashed border-gray-300 rounded-md text-center">
                    No participants for this role
                  </div>
                )}
                {/* Admin-only guest list */}
                {renderGuestsForRole(role.id)}
              </div>
            ))}
          </div>
        ) : event.status === "cancelled" && !managementMode ? (
          /* Cancelled Event Message */
          <div className="text-center py-8">
            <Icon name="tag" className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Sign-ups are closed
            </h3>
            <p className="text-gray-600">
              This event has been cancelled and no longer accepts sign-ups.
            </p>
          </div>
        ) : managementMode ? (
          /* Management View */
          <div className="space-y-6">
            {event.roles.map((role) => (
              <div
                key={role.id}
                className={`border rounded-lg p-4 transition-all duration-200 ${
                  (draggedUserId || draggedGuestId) &&
                  role.currentSignups.length < role.maxParticipants
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, role.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {role.name}
                      </h3>
                      {/* Open to Public Toggle */}
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={role.openToPublic || false}
                            onChange={async (e) => {
                              const newValue = e.target.checked;
                              try {
                                // Optimistic update
                                setEvent((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    roles: prev.roles.map((r) =>
                                      r.id === role.id
                                        ? { ...r, openToPublic: newValue }
                                        : r
                                    ),
                                  };
                                });

                                // Update the backend (suppressNotifications so users are not spammed for visibility toggle)
                                await eventService.updateEvent(event.id, {
                                  roles: event.roles.map((r) =>
                                    r.id === role.id
                                      ? { ...r, openToPublic: newValue }
                                      : r
                                  ),
                                  // Include organizerDetails to satisfy UpdateEventPayload contract
                                  organizerDetails: Array.isArray(
                                    event.organizerDetails
                                  )
                                    ? [...event.organizerDetails]
                                    : [],
                                  suppressNotifications: true,
                                });

                                notification.success(
                                  `Role "${role.name}" ${
                                    newValue ? "opened" : "closed"
                                  } to public registration`,
                                  { title: "Role Updated" }
                                );
                              } catch {
                                // Rollback on error
                                setEvent((prev) => {
                                  if (!prev) return prev;
                                  return {
                                    ...prev,
                                    roles: prev.roles.map((r) =>
                                      r.id === role.id
                                        ? { ...r, openToPublic: !newValue }
                                        : r
                                    ),
                                  };
                                });
                                notification.error(
                                  "Failed to update role public access",
                                  { title: "Update Failed" }
                                );
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">Open to Public</span>
                          {role.openToPublic && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Public
                            </span>
                          )}
                        </label>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {role.description}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-500">
                        {role.currentSignups.length} / {role.maxParticipants}{" "}
                        participants
                        {role.currentSignups.length >= role.maxParticipants && (
                          <span className="text-red-500 ml-1">(Full)</span>
                        )}
                        {role.capacityRemaining !== undefined && (
                          <span className="text-blue-600 ml-2">
                            ({role.capacityRemaining} spots available)
                          </span>
                        )}
                      </p>
                      {role.openToPublic && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ Accepting public registrations
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {role.currentSignups.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-700 mb-2">
                      Current Sign-ups:
                    </h4>
                    {role.currentSignups.map((signup) => {
                      // Ensure the current viewer sees their correct System Authorization Level
                      const displaySystemLevel =
                        signup.userId === currentUserId &&
                        currentUserRole !== "Participant" &&
                        (!signup.systemAuthorizationLevel ||
                          signup.systemAuthorizationLevel === "Participant")
                          ? currentUserRole
                          : signup.systemAuthorizationLevel;
                      return (
                        <div
                          key={signup.userId}
                          className={`flex items-center justify-between p-3 rounded-md cursor-move transition-all duration-200 ${
                            draggedUserId === signup.userId
                              ? "bg-blue-100 shadow-lg scale-105"
                              : "bg-gray-50 hover:bg-gray-100"
                          }`}
                          draggable
                          onDragStart={(e) =>
                            handleDragStart(e, signup.userId, role.id)
                          }
                          onDragEnd={handleDragEnd}
                          title="Drag to move to another role"
                          onClick={(e) => {
                            // Check if click is not on drag area or remove button
                            const target = e.target as HTMLElement;
                            const isButton =
                              target.tagName === "BUTTON" ||
                              target.closest("button");
                            const isDragIndicator =
                              target.textContent?.includes("Drag to move");

                            if (
                              !isButton &&
                              !isDragIndicator &&
                              (canNavigateToProfiles ||
                                signup.userId === currentUserId)
                            ) {
                              handleNameCardClick(
                                signup.userId,
                                `${signup.firstName} ${signup.lastName}`,
                                signup.roleInAtCloud
                              );
                            }
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <img
                              src={getAvatarUrl(
                                signup.avatar || null,
                                signup.gender || "male"
                              )}
                              alt={getAvatarAlt(
                                signup.firstName || "",
                                signup.lastName || "",
                                !!signup.avatar
                              )}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                            <div>
                              <div className="font-medium text-gray-900">
                                {signup.firstName} {signup.lastName}
                              </div>
                              {/* Display both system authorization level and role in @Cloud */}
                              <div className="text-sm text-gray-600 space-y-0.5">
                                {displaySystemLevel && (
                                  <div>
                                    System Authorization Level:{" "}
                                    {displaySystemLevel}
                                  </div>
                                )}
                                {signup.roleInAtCloud && (
                                  <div>
                                    Role in @Cloud: {signup.roleInAtCloud}
                                  </div>
                                )}
                              </div>
                              {signup.notes && (
                                <div className="text-xs text-gray-500 mt-1">
                                  "{signup.notes}"
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-400">
                              Drag to move
                            </span>
                            <button
                              onClick={() =>
                                handleManagementCancel(role.id, signup.userId)
                              }
                              className="bg-red-100 text-red-700 px-3 py-1 rounded-md text-sm hover:bg-red-200 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className={`text-gray-500 text-sm p-4 border-2 border-dashed rounded-md text-center transition-all duration-200 ${
                      draggedUserId
                        ? "border-blue-400 bg-blue-50 text-blue-600"
                        : "border-gray-200"
                    }`}
                  >
                    {draggedUserId
                      ? "Drop user here to assign to this role"
                      : "No sign-ups yet. Drop users here to assign them to this role."}
                  </div>
                )}
                {/* Admin-only guest list (now draggable) */}
                {(() => {
                  const list = guestsByRole[role.id] || [];
                  const isAdminViewer =
                    currentUserRole === "Super Admin" ||
                    currentUserRole === "Administrator" ||
                    isCurrentUserOrganizer;
                  if (!isAdminViewer || list.length === 0) return null;
                  return (
                    <div
                      className="mt-3 space-y-1"
                      data-testid={`admin-guests-${role.id}`}
                    >
                      <h4 className="font-medium text-gray-700">Guests:</h4>
                      <div className="space-y-2">
                        {list.map((g, idx) => (
                          <div
                            key={g.id || idx}
                            className={`flex items-center justify-between p-3 rounded-md border ${
                              draggedGuestId === (g.id || "")
                                ? "bg-blue-100 border-blue-300 shadow"
                                : "bg-white border-gray-200 hover:bg-gray-50"
                            } cursor-move transition-colors`}
                            data-testid={`admin-guest-${g.id || idx}`}
                            draggable
                            onDragStart={(e) =>
                              g.id && handleGuestDragStart(e, g.id, role.id)
                            }
                            onDragEnd={handleDragEnd}
                            title="Drag to move to another role"
                          >
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                                Guest
                              </span>
                              <span className="text-gray-900 font-medium">
                                {g.fullName}
                              </span>
                              {g.notes && (
                                <span className="ml-2 text-xs text-gray-500">
                                  “{g.notes}”
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-xs text-gray-500">
                                {g.email && (
                                  <span className="mr-3">{g.email}</span>
                                )}
                                {g.phone && <span>{g.phone}</span>}
                              </div>
                              {g.id && (
                                <div className="flex items-center gap-2">
                                  <button
                                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                                    onClick={() => {
                                      setResendLinkConfirm({
                                        open: true,
                                        guestId: g.id!,
                                        guestName: g.fullName,
                                      });
                                    }}
                                  >
                                    Re-send manage link
                                  </button>
                                  <button
                                    className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600"
                                    onClick={() => {
                                      setCancelConfirm({
                                        open: true,
                                        roleId: role.id,
                                        guest: g,
                                      });
                                    }}
                                  >
                                    Cancel Guest
                                  </button>
                                  <button
                                    className="text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700"
                                    onClick={() => {
                                      setEditGuest({
                                        open: true,
                                        roleId: role.id,
                                        guest: g,
                                      });
                                    }}
                                  >
                                    Edit Guest
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          /* Normal Sign-up View */
          <div className="space-y-4">
            {event.roles.map((role) => {
              // Check if user is already signed up for this specific role
              const isSignedUpForThisRole = role.currentSignups.some(
                (signup) => signup.userId === currentUserId
              );

              // Get ALL viewer's workshop group letters (fix for multi-group bug)
              // Determine guest count for this role (includes guests for capacity display and full-state)
              const guestCountForRole = guestsByRole[role.id]?.length || 0;

              return (
                <EventRoleSignup
                  key={role.id}
                  role={role}
                  onSignup={handleRoleSignup}
                  onCancel={handleRoleCancel}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  isUserSignedUpForThisRole={isSignedUpForThisRole}
                  hasReachedMaxRoles={hasReachedMaxRoles}
                  maxRolesForUser={maxRolesForUser}
                  isRoleAllowedForUser={isRoleAllowedForUser(role.name)}
                  eventId={event.id}
                  organizerDetails={event.organizerDetails}
                  guestCount={guestCountForRole}
                  guestList={guestsByRole[role.id]}
                  isOrganizer={!!canManageSignups}
                  onAssignUser={async (
                    roleId,
                    userId,
                    sendNotifications = true
                  ) => {
                    try {
                      const updatedEvent = await eventService.assignUserToRole(
                        event.id,
                        userId,
                        roleId,
                        undefined, // notes
                        sendNotifications
                      );
                      const convertedEvent: EventData = {
                        ...event,
                        roles: updatedEvent.roles.map((role: BackendRole) => ({
                          id: role.id,
                          name: role.name,
                          description: role.description,
                          agenda: (role as { agenda?: string }).agenda,
                          maxParticipants: role.maxParticipants,
                          currentSignups: role.registrations
                            ? role.registrations.map(
                                (reg: BackendRegistration) => ({
                                  userId: reg.user.id,
                                  username: reg.user.username,
                                  firstName: reg.user.firstName,
                                  lastName: reg.user.lastName,
                                  email: reg.user.email,
                                  phone: reg.user.phone,
                                  avatar: reg.user.avatar,
                                  gender: reg.user.gender,
                                  systemAuthorizationLevel: ((
                                    reg.user as { role?: string }
                                  ).role ||
                                    reg.user
                                      .systemAuthorizationLevel) as string,
                                  roleInAtCloud: reg.user.roleInAtCloud,
                                  notes: reg.notes,
                                  registeredAt: reg.registeredAt,
                                })
                              )
                            : role.currentSignups || [],
                        })),
                        signedUp:
                          updatedEvent.signedUp ||
                          updatedEvent.roles?.reduce(
                            (sum: number, role: BackendRole) =>
                              sum +
                              (role.registrations?.length ||
                                role.currentSignups?.length ||
                                0),
                            0
                          ) ||
                          0,
                      };
                      setEvent(convertedEvent);
                      const roleName =
                        event.roles.find((r) => r.id === roleId)?.name ||
                        "role";
                      notification.success(
                        `User has been assigned to ${roleName}.`,
                        {
                          title: "Assignment Complete",
                        }
                      );
                    } catch (error: unknown) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : "Failed to assign user.";
                      notification.error(message, {
                        title: "Assignment Failed",
                      });
                    }
                  }}
                />
              );
            })}
            {/* Admin-only guest lists below roles (retain for full contact controls) */}
            <div className="space-y-6">
              {event.roles.map((role) => (
                <div key={`guests-${role.id}`}>
                  {renderGuestsForRole(role.id)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Event Deletion Modal */}
      {event && (
        <EventDeletionModal
          isOpen={showDeletionModal}
          onClose={() => setShowDeletionModal(false)}
          onDelete={handleDeleteEvent}
          onCancel={handleCancelEvent}
          eventTitle={event.title}
        />
      )}

      {/* Guest Cancel Confirmation */}
      <ConfirmationModal
        isOpen={cancelConfirm.open}
        onClose={() => setCancelConfirm({ open: false })}
        onConfirm={async () => {
          // Immediately close the modal for snappy UX
          setCancelConfirm({ open: false });
          if (!cancelConfirm.guest?.id || !cancelConfirm.roleId) return;
          const roleId = cancelConfirm.roleId;
          const guestId = cancelConfirm.guest.id;
          const prev = guestsByRole[roleId] || [];
          const updated = prev.filter((x) => x.id !== guestId);
          // Optimistically update UI
          setGuestsByRole({ ...guestsByRole, [roleId]: updated });
          try {
            await GuestApi.adminCancelGuest(guestId, undefined, {
              eventId: event?.id,
            });
            notification.success("Guest registration cancelled.", {
              title: "Cancelled",
            });
          } catch (error: unknown) {
            // Rollback on failure
            setGuestsByRole({ ...guestsByRole, [roleId]: prev });
            notification.error(
              error instanceof Error
                ? error.message
                : "Failed to cancel guest registration.",
              { title: "Cancel Failed" }
            );
          }
        }}
        title="Cancel guest?"
        message="Cancel this guest's registration?"
        confirmText="Yes, cancel"
        type="danger"
      />

      {/* Guest Edit Modal */}
      <GuestEditModal
        isOpen={editGuest.open}
        initialName={editGuest.guest?.fullName || ""}
        initialPhone={editGuest.guest?.phone || ""}
        onClose={() => setEditGuest({ open: false })}
        onSave={async ({ fullName, phone }) => {
          if (!editGuest.guest?.id || !editGuest.roleId) return;
          const guestId = editGuest.guest.id;
          const roleId = editGuest.roleId;
          try {
            await GuestApi.adminUpdateGuest(
              guestId,
              { fullName, phone },
              { eventId: event?.id }
            );
            setGuestsByRole((prev) => {
              const list = prev[roleId] || [];
              const next = list.map((x) =>
                x.id === guestId
                  ? {
                      ...x,
                      fullName: fullName || x.fullName,
                      // if phone is an empty string, clear it; else use provided or existing
                      phone:
                        typeof phone === "string" && phone.trim().length === 0
                          ? undefined
                          : phone ?? x.phone,
                    }
                  : x
              );
              return { ...prev, [roleId]: next };
            });
            notification.success("Guest details updated.", {
              title: "Updated",
            });
            setEditGuest({ open: false });
          } catch (error: unknown) {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to update guest.";
            notification.error(message, {
              title: "Update Failed",
            });
          }
        }}
      />

      {/* Name Card Action Modal */}
      <NameCardActionModal
        isOpen={nameCardModal.isOpen}
        onClose={() => setNameCardModal({ ...nameCardModal, isOpen: false })}
        userId={nameCardModal.userId}
        userName={nameCardModal.userName}
        userRole={nameCardModal.userRole}
      />

      {/* Email Participants Modal */}
      {emailModal.open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-participants-title"
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6">
              <h2
                id="email-participants-title"
                className="text-lg font-semibold mb-4"
              >
                Email Participants
              </h2>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="email-subject"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Subject
                  </label>
                  <input
                    id="email-subject"
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={emailModal.subject}
                    onChange={(e) =>
                      setEmailModal((m) => ({ ...m, subject: e.target.value }))
                    }
                    placeholder={`Regarding: ${event.title}`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Message
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Bold"
                        className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                        onClick={() => applyEditorCommand("bold")}
                      >
                        B
                      </button>
                      <button
                        type="button"
                        title="Italic"
                        className="px-2 py-1 text-sm border rounded hover:bg-gray-50 italic"
                        onClick={() => applyEditorCommand("italic")}
                      >
                        I
                      </button>
                      <button
                        type="button"
                        title="Bulleted list"
                        className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                        onClick={() =>
                          applyEditorCommand("insertUnorderedList")
                        }
                      >
                        ••
                      </button>
                      <button
                        type="button"
                        title="Numbered list"
                        className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                        onClick={() => applyEditorCommand("insertOrderedList")}
                      >
                        1.
                      </button>
                      <button
                        type="button"
                        title="Insert link"
                        className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                        onClick={() => {
                          const url = window.prompt("Enter URL", "https://");
                          if (!url) return;
                          applyEditorCommand("createLink", url);
                        }}
                      >
                        Link
                      </button>
                      <button
                        type="button"
                        title="Clear formatting"
                        className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                        onClick={() => applyEditorCommand("removeFormat")}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div
                    ref={emailEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Message editor"
                    aria-multiline="true"
                    className="rich-editor min-h-[180px] max-h-[360px] overflow-y-auto border rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onInput={() =>
                      setEmailModal((m) => ({
                        ...m,
                        bodyHtml: emailEditorRef.current?.innerHTML || "",
                      }))
                    }
                    onPaste={(e) => {
                      e.preventDefault();
                      const text = e.clipboardData.getData("text/plain");
                      // insert as plain text to avoid messy HTML
                      document.execCommand("insertText", false, text);
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Basic formatting supported. Replies go to the organizer.
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={emailModal.includeUsers}
                      onChange={(e) =>
                        setEmailModal((m) => ({
                          ...m,
                          includeUsers: e.target.checked,
                        }))
                      }
                    />
                    Include registered users
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={emailModal.includeGuests}
                      onChange={(e) =>
                        setEmailModal((m) => ({
                          ...m,
                          includeGuests: e.target.checked,
                        }))
                      }
                    />
                    Include guests
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setEmailModal({
                      open: false,
                      subject: "",
                      bodyHtml: "",
                      includeUsers: true,
                      includeGuests: false,
                      sending: false,
                    })
                  }
                  disabled={emailModal.sending}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!id) return;
                    const subject = emailModal.subject.trim();
                    const bodyHtml = emailModal.bodyHtml.trim();
                    if (!subject || !bodyHtml) {
                      notification.error("Subject and message are required.", {
                        title: "Missing Fields",
                      });
                      return;
                    }
                    try {
                      setEmailModal((m) => ({ ...m, sending: true }));
                      const res = await eventService.sendEventEmails(id, {
                        subject,
                        bodyHtml,
                        includeGuests: emailModal.includeGuests,
                        includeUsers: emailModal.includeUsers,
                      });
                      const count: number =
                        typeof res.recipientCount === "number"
                          ? res.recipientCount
                          : typeof res.sent === "number"
                          ? res.sent
                          : 0;
                      notification.success(
                        count > 0
                          ? `Email sent to ${count} recipient${
                              count === 1 ? "" : "s"
                            }.`
                          : "No recipients found for this event.",
                        { title: "Email Sent" }
                      );
                      setEmailModal({
                        open: false,
                        subject: "",
                        bodyHtml: "",
                        includeUsers: true,
                        includeGuests: false,
                        sending: false,
                      });
                    } catch (e: unknown) {
                      const message =
                        e instanceof Error
                          ? e.message
                          : "Failed to send emails.";
                      notification.error(message, { title: "Send Failed" });
                      setEmailModal((m) => ({ ...m, sending: false }));
                    }
                  }}
                  disabled={emailModal.sending}
                  className="px-4 py-2 text-sm font-medium text-white rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {emailModal.sending ? "Sending..." : "Send Email"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resend Link Confirmation Modal */}
      <ConfirmationModal
        isOpen={resendLinkConfirm.open}
        onClose={() => setResendLinkConfirm({ open: false })}
        onConfirm={async () => {
          if (!resendLinkConfirm.guestId) {
            setResendLinkConfirm({ open: false });
            return;
          }
          try {
            await GuestApi.resendManageLink(resendLinkConfirm.guestId, {
              eventId: event?.id,
            });
            notification.success("Manage link sent to guest.", {
              title: "Email Sent",
            });
          } catch (e: unknown) {
            const { friendlyGenericError } = await import(
              "../utils/errorMessages"
            );
            notification.error(
              friendlyGenericError(e, "Failed to send manage link."),
              { title: "Send Failed" }
            );
          } finally {
            setResendLinkConfirm({ open: false });
          }
        }}
        title="Send Manage Link"
        message={`Send a fresh manage link to ${resendLinkConfirm.guestName} via email?`}
        confirmText="Yes, Send Link"
        cancelText="Cancel"
        type="info"
      />

      {/* Share Modal */}
      {event && (
        <ShareModal
          eventId={event.id}
          publicSlug={event.publicSlug || ""}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
