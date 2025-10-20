import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext";
import { useAuth } from "../hooks/useAuth";
import { useAvatarUpdates } from "../hooks/useAvatarUpdates";
import { socketService } from "../services/socketService";
import { Icon } from "../components/common";
import ConfirmationModal from "../components/common/ConfirmationModal";
import AlertModal from "../components/common/AlertModal";
import Pagination from "../components/common/Pagination";
import { systemMessageService } from "../services/systemMessageService";
import type { SystemMessage } from "../types/notification";
import { formatViewerLocalDateTime } from "../utils/timezoneUtils";
import {
  UserGroupIcon,
  UserIcon,
  KeyIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";

// Narrow types and guards for metadata to avoid any-casts
type TimingMeta = {
  originalDate?: string;
  originalTime?: string;
  originalTimeZone?: string;
  eventDateTimeUtc?: string;
};

type RoleInviteMetadata = {
  eventId?: string;
  eventDetailUrl?: string;
  rejectionLink?: string;
  timing?: TimingMeta;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isTimingMeta(v: unknown): v is TimingMeta {
  if (!isRecord(v)) return false;
  const od = v["originalDate"]; // may be undefined
  const ot = v["originalTime"]; // may be undefined
  const oz = v["originalTimeZone"]; // may be undefined
  const utc = v["eventDateTimeUtc"]; // may be undefined
  const ok =
    (od === undefined || typeof od === "string") &&
    (ot === undefined || typeof ot === "string") &&
    (oz === undefined || typeof oz === "string") &&
    (utc === undefined || typeof utc === "string");
  return ok;
}

function readRoleInviteMetadata(message: SystemMessage): RoleInviteMetadata {
  const meta = message.metadata;
  if (!isRecord(meta)) return {};
  const eventId = typeof meta.eventId === "string" ? meta.eventId : undefined;
  const metaRec = meta as Record<string, unknown>;
  const eventDetailUrl =
    typeof metaRec["eventDetailUrl"] === "string"
      ? String(metaRec["eventDetailUrl"])
      : undefined;
  const rejectionLink =
    typeof metaRec["rejectionLink"] === "string"
      ? String(metaRec["rejectionLink"])
      : undefined;
  const timingRaw = metaRec["timing"];
  const timing = isTimingMeta(timingRaw) ? timingRaw : undefined;
  return { eventId, eventDetailUrl, rejectionLink, timing };
}

// (Removed unused formatUserLocal helper – inline formatting used instead)

export default function SystemMessages() {
  const { systemMessages, markSystemMessageAsRead, reloadSystemMessages } =
    useNotifications();
  const { hasRole, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sendDropdownOpen, setSendDropdownOpen] = useState(false);

  // Listen for real-time avatar updates to refresh message sender avatars
  const avatarUpdateCounter = useAvatarUpdates();

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    messageId: string;
    messageTitle: string;
  }>({
    isOpen: false,
    messageId: "",
    messageTitle: "",
  });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  // Helper function to show alert
  const showAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info" = "info"
  ) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  // Local paginated state pulled from backend
  const [pagedMessages, setPagedMessages] = useState<SystemMessage[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadPage = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const { messages, pagination } =
          await systemMessageService.getSystemMessagesPaginated({
            page,
            limit: pageSize,
          });
        setPagedMessages(messages);
        setCurrentPage(pagination.currentPage);
        setTotalCount(pagination.totalCount);
        setTotalPages(pagination.totalPages);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  // When global system messages change (e.g., via WebSocket), refresh current page
  useEffect(() => {
    if (systemMessages) {
      loadPage(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemMessages?.length]);

  // Reload messages when avatars are updated
  useEffect(() => {
    if (avatarUpdateCounter > 0) {
      loadPage(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarUpdateCounter]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      socketService.connect(token);
    }
  }, []);

  // Filter system messages - auth level changes only for current user, others for all
  const filteredSystemMessages = useMemo(
    () =>
      pagedMessages
        .filter((message) => {
          if (message.type === "auth_level_change") {
            // Show auth level change messages to:
            // 1. The target user (when targetUserId matches current user)
            // 2. Admin users (for oversight purposes, regardless of targetUserId)
            const isTargetUser = message.targetUserId === currentUser?.id;
            const isAdmin =
              currentUser?.role === "Administrator" ||
              currentUser?.role === "Super Admin";
            const shouldShow = isTargetUser || isAdmin;
            return shouldShow;
          }

          if (message.type === "user_management") {
            // Admin-only visibility for user management messages
            return (
              currentUser?.role === "Administrator" ||
              currentUser?.role === "Super Admin"
            );
          }

          if (message.type === "atcloud_role_change") {
            // Only show @Cloud role change notifications to admin users for oversight
            return (
              currentUser?.role === "Administrator" ||
              currentUser?.role === "Super Admin"
            );
          }

          if (message.type === "event_role_change") {
            // Show event role change messages to:
            // 1. The target user (when targetUserId matches current user)
            // 2. Admin users (for oversight purposes, regardless of targetUserId)
            const isTargetUser = message.targetUserId === currentUser?.id;
            const isAdmin =
              currentUser?.role === "Administrator" ||
              currentUser?.role === "Super Admin";
            const shouldShow = isTargetUser || isAdmin;
            return shouldShow;
          }

          // Show all other system messages to everyone (including real security alerts)
          return true;
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [pagedMessages, currentUser?.id, currentUser?.role]
  );

  // Handle URL hash navigation to scroll to specific message
  useEffect(() => {
    if (location.hash) {
      const messageId = location.hash.substring(1); // Remove the # symbol
      const messageElement = document.getElementById(messageId);
      if (messageElement) {
        // Scroll to the message
        messageElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Mark the message as read if it's not already
        const message = filteredSystemMessages.find((m) => m.id === messageId);
        if (message && !message.isRead) {
          markSystemMessageAsRead(messageId);
        }

        // Add a brief highlight effect
        messageElement.classList.add(
          "ring-2",
          "ring-blue-500",
          "ring-opacity-75"
        );
        setTimeout(() => {
          messageElement.classList.remove(
            "ring-2",
            "ring-blue-500",
            "ring-opacity-75"
          );
        }, 2000);

        // Clear the hash after handling to prevent re-triggering
        // Use react-router navigate so location.hash updates and effect doesn't re-run
        navigate(location.pathname, { replace: true });
      }
    }
  }, [
    location.hash,
    filteredSystemMessages,
    markSystemMessageAsRead,
    navigate,
    location.pathname,
  ]);

  // Check if current user can navigate to other user profiles
  const canNavigateToProfiles =
    currentUser?.role === "Super Admin" ||
    currentUser?.role === "Administrator" ||
    currentUser?.role === "Leader";

  // Get the correct profile link (matching EventDetail and Management page logic)
  const getProfileLink = (userId: string) => {
    const currentUserId =
      currentUser?.id || "550e8400-e29b-41d4-a716-446655440000";
    return userId === currentUserId
      ? "/dashboard/profile" // Own profile page (editable)
      : `/dashboard/profile/${userId}`; // View-only profile page
  };

  // Handle name card click - direct navigation with role-based authorization
  const handleNameCardClick = (userId: string) => {
    const currentUserId =
      currentUser?.id || "550e8400-e29b-41d4-a716-446655440000";

    // If clicking on self, always allow navigation to own profile
    if (userId === currentUserId) {
      navigate(getProfileLink(userId));
      return;
    }

    // Only Super Admin, Administrator, and Leader can view other users' profiles
    // Guest Expert and Participant cannot (name cards should not be clickable for them)
    if (canNavigateToProfiles) {
      navigate(getProfileLink(userId));
    }
    // If not authorized, do nothing (name card should not be clickable anyway)
  };
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "announcement" as
      | "announcement"
      | "maintenance"
      | "update"
      | "warning",
    priority: "medium" as "high" | "medium" | "low",
    includeCreator: true, // Add option to include creator info
  });

  const TITLE_MIN = 5;
  const TITLE_MAX = 200;
  const CONTENT_MIN = 5;
  const CONTENT_MAX = 3500;

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSendToAll = async () => {
    await handleSendMessage(undefined);
  };

  const handleSendMessage = async (targetRoles?: string[]) => {
    // Validate required fields
    if (!formData.title.trim() || !formData.content.trim()) {
      showAlert(
        "Validation Error",
        "Please fill in both title and content fields.",
        "error"
      );
      return;
    }

    try {
      // Prepare the message payload
      const messagePayload: {
        title: string;
        content: string;
        type: string;
        priority: string;
        includeCreator: boolean;
        targetRoles?: string[];
      } = {
        title: formData.title,
        content: formData.content,
        type: formData.type,
        priority: formData.priority,
        includeCreator: formData.includeCreator,
      };

      // Add targetRoles if specified
      if (targetRoles && targetRoles.length > 0) {
        messagePayload.targetRoles = targetRoles;
      }

      // Create the system message using the service
      await systemMessageService.createSystemMessage(messagePayload);

      // Clear form and close modal
      setFormData({
        title: "",
        content: "",
        type: "announcement",
        priority: "medium",
        includeCreator: true,
      });
      setShowCreateForm(false);
      setSendDropdownOpen(false);

      // REMOVED: await reloadSystemMessages() - let WebSocket events handle the real-time update
      // This ensures the creator sees the message appear in real-time just like other users

      // Show success message based on target
      const recipientText = targetRoles
        ? getRecipientDisplayText(targetRoles)
        : "all users";
      showAlert(
        "Success",
        `System message sent to ${recipientText} successfully!`,
        "success"
      );
    } catch (error) {
      console.error("Error creating system message:", error);
      showAlert(
        "Error",
        "Failed to create system message. Please try again.",
        "error"
      );
    }
  };

  // Helper function to get display text for recipients
  const getRecipientDisplayText = (targetRoles: string[]): string => {
    if (
      targetRoles.includes("Super Admin") &&
      targetRoles.includes("Administrator") &&
      targetRoles.length === 2
    ) {
      return "admins";
    }
    if (
      targetRoles.includes("Super Admin") &&
      targetRoles.includes("Administrator") &&
      targetRoles.includes("Leader") &&
      targetRoles.length === 3
    ) {
      return "@Cloud co-workers";
    }
    if (targetRoles.length === 1) {
      if (targetRoles[0] === "Guest Expert") {
        return "Guest Experts";
      }
      if (targetRoles[0] === "Participant") {
        return "Participants";
      }
    }
    return "selected users";
  };

  const handleClearForm = () => {
    setFormData({
      title: "",
      content: "",
      type: "announcement",
      priority: "medium",
      includeCreator: true,
    });
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setFormData({
      title: "",
      content: "",
      type: "announcement",
      priority: "medium",
      includeCreator: true,
    });
  };

  const handleMessageClick = (messageId: string) => {
    markSystemMessageAsRead(messageId);
    // Optimistically update local paged state
    setPagedMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, isRead: true, readAt: new Date().toISOString() }
          : m
      )
    );
  };

  const handleDeleteMessage = (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation(); // Prevent triggering the message click
    const message = filteredSystemMessages.find((m) => m.id === messageId);
    setDeleteConfirmation({
      isOpen: true,
      messageId,
      messageTitle: message?.title || "this system message",
    });
  };

  const confirmDeleteMessage = async () => {
    try {
      await systemMessageService.deleteSystemMessage(
        deleteConfirmation.messageId
      );
      await reloadSystemMessages(); // Keep bell dropdown/state in sync
      await loadPage(currentPage); // Refresh current page to reflect deletion and totals
      setDeleteConfirmation({
        isOpen: false,
        messageId: "",
        messageTitle: "",
      });
      showAlert("System message deleted successfully", "success");
    } catch (error) {
      console.error("Failed to delete system message:", error);
      showAlert("Failed to delete system message", "error");
    }
  };

  const cancelDeleteMessage = () => {
    setDeleteConfirmation({
      isOpen: false,
      messageId: "",
      messageTitle: "",
    });
  };

  const formatDate = (dateString: string) => {
    // Parse date string safely to avoid timezone issues
    let date: Date;

    if (dateString.includes("T")) {
      // If it's an ISO string, use it directly (for timestamps)
      date = new Date(dateString);
    } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // If it's YYYY-MM-DD format, parse manually to avoid timezone shift
      const [year, month, day] = dateString.split("-").map(Number);
      date = new Date(year, month - 1, day); // month is 0-indexed
    } else {
      // Fallback to regular parsing for other formats
      date = new Date(dateString);
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTypeIcon = (type: string, message?: { title?: string }) => {
    switch (type) {
      case "announcement":
        return (
          <img
            src="/marketing.svg"
            alt="Marketing"
            className="w-7 h-7"
            style={{
              filter:
                "brightness(0) saturate(100%) invert(26%) sepia(94%) saturate(6338%) hue-rotate(212deg) brightness(99%) contrast(91%)",
            }}
          />
        );
      case "maintenance":
        return <Icon name="shield-check" className="w-5 h-5 text-orange-400" />; // Shield for system maintenance/protection
      case "update":
        return <Icon name="check-circle" className="w-5 h-5" />; // Check circle for successful updates
      case "warning":
        return <Icon name="x-circle" className="w-5 h-5" />; // X circle for warnings/alerts
      case "auth_level_change":
        return (
          <img
            src="/permission-management.svg"
            alt="Permission Management"
            className="w-7 h-7"
            style={{
              filter:
                "brightness(0) saturate(100%) invert(52%) sepia(41%) saturate(459%) hue-rotate(74deg) brightness(98%) contrast(90%)",
            }}
          />
        ); // New icon for auth level changes
      case "user_management": {
        const title = (message?.title || "").toLowerCase();
        const isRed =
          title.includes("deactivated") || title.includes("deleted");
        const colorClass = isRed ? "text-red-600" : "text-green-600"; // keep green for reactivated
        return <Icon name="user" className={`w-5 h-5 ${colorClass}`} />; // Old auth icon reused with dynamic color
      }
      case "atcloud_role_change":
        return <Icon name="tag" className="w-5 h-5" />; // Tag icon for @Cloud ministry role changes
      case "event_role_change":
        return (
          <img
            src="/change.svg"
            alt="Role Change"
            className="w-7 h-7"
            style={{
              filter:
                "brightness(0) saturate(100%) invert(41%) sepia(68%) saturate(2557%) hue-rotate(180deg) brightness(95%) contrast(101%)",
            }}
          />
        ); // Change icon for event role changes
      default:
        return <Icon name="mail" className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string, message?: { title?: string }) => {
    switch (type) {
      case "announcement":
        return "text-blue-600"; // Blue for announcements (marketing)
      case "maintenance":
        return "text-orange-400"; // Light orange for maintenance (shield)
      case "update":
        return "text-green-600"; // Green for updates (check)
      case "warning":
        return "text-red-600"; // Red for warnings (x-circle)
      case "auth_level_change":
        return "text-green-600"; // Keep green coloring for permission icon
      case "user_management": {
        const title = (message?.title || "").toLowerCase();
        const isRed =
          title.includes("deactivated") || title.includes("deleted");
        return isRed ? "text-red-600" : "text-green-600";
      }
      case "atcloud_role_change":
        return "text-purple-600"; // Purple for @Cloud ministry role changes (tag)
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                System Messages
              </h1>
              <p className="text-gray-600">
                Important announcements and system updates
              </p>
            </div>
          </div>

          {/* Create Button - Available to Super Admin, Administrator, and Leader only */}
          {(hasRole("Super Admin") ||
            hasRole("Administrator") ||
            hasRole("Leader")) && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Icon name="plus" className="w-5 h-5" />
              <span>Create New System Message</span>
            </button>
          )}
        </div>{" "}
      </div>

      {/* Stats */}
      {totalCount > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {/* Unread count is approximate on page; full count from backend is optional */}
            </span>
            <span>
              {totalCount} total message{totalCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}

      {/* Top Pagination controls (no container background) */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          hasNext={currentPage < totalPages && !loading}
          hasPrev={currentPage > 1 && !loading}
          onPageChange={loadPage}
          showPageNumbers={false}
          size="md"
          variant="default"
        />
      )}

      {/* Messages List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500">Loading system messages…</p>
          </div>
        ) : filteredSystemMessages.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Icon
              name="mail"
              className="w-12 h-12 mx-auto mb-4 text-gray-300"
            />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No system messages
            </h3>
            <p className="text-gray-500">
              You're all caught up! Check back later for system updates.
            </p>
          </div>
        ) : (
          filteredSystemMessages.map((message) => (
            <div
              key={message.id}
              id={message.id}
              onClick={() => handleMessageClick(message.id)}
              className={`bg-white rounded-lg shadow-sm border cursor-pointer transition-all duration-200 hover:shadow-md ${
                !message.isRead
                  ? "border-blue-200 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`${getTypeColor(message.type, message)}`}>
                      {getTypeIcon(message.type, message)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {message.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formatDate(message.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Priority Badge */}
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-md border ${getPriorityColor(
                        message.priority
                      )}`}
                    >
                      {message.priority.toUpperCase()}
                    </span>
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteMessage(e, message.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Delete message"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                    {/* Unread Indicator */}
                    {!message.isRead && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {(() => {
                      // Replace Event Time line with viewer local time for Role Invited messages
                      if (
                        message.type === "event_role_change" &&
                        message.title === "Role Invited"
                      ) {
                        const { timing } = readRoleInviteMetadata(message);
                        if (timing?.originalDate && timing?.originalTime) {
                          const localized = formatViewerLocalDateTime({
                            date: timing.originalDate,
                            time: timing.originalTime,
                            timeZone: timing.originalTimeZone,
                            eventDateTimeUtc: timing.eventDateTimeUtc,
                          });
                          if (localized) {
                            return message.content.replace(
                              /Event Time:.*?(\n|$)/,
                              `Event Time: ${localized.date} • ${localized.time} (your local time)$1`
                            );
                          }
                        }
                      }
                      return message.content;
                    })()}
                  </p>
                  {/* Local time already inlined by replacing Event Time line above */}
                  {typeof message.metadata?.eventId === "string" &&
                    (message.title.startsWith("New Event:") ||
                      message.title.startsWith("Event Updated:") ||
                      message.title.startsWith("New Recurring Program:")) && (
                      <div className="mt-4">
                        <a
                          href={`/dashboard/event/${String(
                            message.metadata?.eventId
                          )}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block w-full text-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                        >
                          View Event Details
                        </a>
                      </div>
                    )}

                  {/* CTA buttons for Role Invited system messages */}
                  {message.type === "event_role_change" &&
                    message.title === "Role Invited" && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(() => {
                          const { eventId, eventDetailUrl } =
                            readRoleInviteMetadata(message);
                          const href =
                            eventDetailUrl ||
                            (typeof eventId === "string"
                              ? `/dashboard/event/${eventId}`
                              : undefined);
                          if (!href) return null;
                          return (
                            <a
                              href={href}
                              onClick={(e) => e.stopPropagation()}
                              className="block w-full text-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                            >
                              See the Event & Role Details
                            </a>
                          );
                        })()}

                        {(() => {
                          const { rejectionLink } =
                            readRoleInviteMetadata(message);
                          if (typeof rejectionLink !== "string") return null;
                          return (
                            <a
                              href={rejectionLink}
                              onClick={(e) => e.stopPropagation()}
                              className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-lg shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all"
                            >
                              Decline This Invitation
                            </a>
                          );
                        })()}
                      </div>
                    )}
                </div>

                {/* Creator Information */}
                {message.creator && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div
                      className={`flex items-center space-x-3 -mx-2 px-2 py-2 rounded-md transition-colors ${
                        canNavigateToProfiles ||
                        message.creator.id ===
                          (currentUser?.id ||
                            "550e8400-e29b-41d4-a716-446655440000")
                          ? "cursor-pointer hover:bg-gray-50"
                          : "cursor-default"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering the message click
                        if (message.creator) {
                          handleNameCardClick(message.creator.id);
                        }
                      }}
                      title={
                        canNavigateToProfiles ||
                        message.creator.id ===
                          (currentUser?.id ||
                            "550e8400-e29b-41d4-a716-446655440000")
                          ? `View ${message.creator.firstName} ${message.creator.lastName}'s profile`
                          : undefined
                      }
                    >
                      {(() => {
                        const baseAvatar = message.creator.avatar || null;
                        let avatarUrl;

                        if (
                          baseAvatar &&
                          !baseAvatar.includes("default-avatar")
                        ) {
                          // Keep the existing URL from database (which has fresh timestamp)
                          // Just add counter to ensure browser sees it as different
                          const separator = baseAvatar.includes("?")
                            ? "&"
                            : "?";
                          avatarUrl = `${baseAvatar}${separator}v=${avatarUpdateCounter}`;
                        } else {
                          // Use default avatar
                          const gender = message.creator.gender;
                          avatarUrl =
                            gender === "male"
                              ? "/default-avatar-male.jpg"
                              : "/default-avatar-female.jpg";
                        }

                        return (
                          <img
                            className="w-8 h-8 rounded-full object-cover"
                            src={avatarUrl}
                            alt={`${message.creator.firstName} ${message.creator.lastName}`}
                          />
                        );
                      })()}
                      <div>
                        <p className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                          {message.creator.firstName} {message.creator.lastName}
                        </p>
                        {/* Show both authLevel and roleInAtCloud when available */}
                        {(message.creator.authLevel ||
                          message.creator.roleInAtCloud) && (
                          <p className="text-xs text-gray-500">
                            {[
                              message.creator.authLevel,
                              message.creator.roleInAtCloud,
                            ]
                              .filter(Boolean) // Remove null/undefined values
                              .filter(
                                (value, index, array) =>
                                  array.indexOf(value) === index
                              ) // Remove duplicates
                              .join(" • ")}{" "}
                            {/* Use bullet separator */}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Read Timestamp for read messages */}
                {message.isRead && message.readAt && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <span className="inline-flex items-center space-x-1 text-xs text-gray-500">
                      <span>Read:</span>
                      <span className="font-medium">
                        {formatDate(message.readAt)}
                      </span>
                    </span>
                  </div>
                )}

                {/* Type Badge */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="inline-flex items-center space-x-1 text-xs text-gray-500">
                    <span>Type:</span>
                    <span className="font-medium capitalize">
                      {message.type.replace("_", " ")}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Pagination controls (no container background) */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          hasNext={currentPage < totalPages && !loading}
          hasPrev={currentPage > 1 && !loading}
          onPageChange={loadPage}
          showPageNumbers={false}
          size="md"
          variant="default"
        />
      )}

      {/* Create System Message Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Create New System Message
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Icon name="x-mark" className="w-6 h-6" />
                </button>
              </div>

              <form className="space-y-4">
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter message title..."
                    required
                  />
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className={`$${""}`}></span>
                    <span
                      className={`text-gray-500 ${
                        formData.title.length > TITLE_MAX ? "text-red-600" : ""
                      }`}
                    >
                      {formData.title.length}/{TITLE_MAX}
                    </span>
                  </div>
                  {formData.title.trim().length > 0 &&
                    formData.title.trim().length < TITLE_MIN && (
                      <p className="mt-1 text-xs text-red-600">
                        Title must be at least {TITLE_MIN} characters.
                      </p>
                    )}
                  {formData.title.length > TITLE_MAX && (
                    <p className="mt-1 text-xs text-red-600">
                      Title must be at most {TITLE_MAX} characters.
                    </p>
                  )}
                </div>

                {/* Include Creator Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="includeCreator"
                    name="includeCreator"
                    checked={formData.includeCreator}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        includeCreator: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="includeCreator"
                    className="text-sm font-medium text-gray-700"
                  >
                    Include "Message from" information
                  </label>
                </div>

                {/* Message From - Creator Info */}
                {formData.includeCreator && currentUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message from
                    </label>
                    <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                      <div
                        className="flex items-center space-x-3 cursor-pointer hover:bg-gray-100 -mx-1 px-1 py-1 rounded-md transition-colors"
                        onClick={() => {
                          if (currentUser) {
                            handleNameCardClick(currentUser.id);
                          }
                        }}
                        title={`View your profile`}
                      >
                        <img
                          className="w-10 h-10 rounded-full object-cover"
                          src={
                            currentUser.avatar ||
                            (currentUser.gender === "female"
                              ? "/default-avatar-female.jpg"
                              : "/default-avatar-male.jpg")
                          }
                          alt={`${currentUser.firstName} ${currentUser.lastName}`}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                            {currentUser.firstName} {currentUser.lastName}
                          </p>
                          {/* Show both role (authLevel) and roleInAtCloud when available */}
                          {(currentUser.role || currentUser.roleInAtCloud) && (
                            <p className="text-xs text-gray-500">
                              {[currentUser.role, currentUser.roleInAtCloud]
                                .filter(Boolean) // Remove null/undefined values
                                .filter(
                                  (value, index, array) =>
                                    array.indexOf(value) === index
                                ) // Remove duplicates
                                .join(" • ")}{" "}
                              {/* Use bullet separator */}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Help text for when creator is not included */}
                {!formData.includeCreator && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <Icon name="lightning" className="w-4 h-4 inline mr-1" />
                      This message will appear as a system-generated
                      announcement without creator information.
                    </p>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="content"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Content
                  </label>
                  <textarea
                    id="content"
                    name="content"
                    value={formData.content}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter message content..."
                    required
                  />
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className={`$${""}`}></span>
                    <span
                      className={`text-gray-500 ${
                        formData.content.length > CONTENT_MAX
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      {formData.content.length}/{CONTENT_MAX}
                    </span>
                  </div>
                  {formData.content.trim().length > 0 &&
                    formData.content.trim().length < CONTENT_MIN && (
                      <p className="mt-1 text-xs text-red-600">
                        Content must be at least {CONTENT_MIN} characters.
                      </p>
                    )}
                  {formData.content.length > CONTENT_MAX && (
                    <p className="mt-1 text-xs text-red-600">
                      Content must be at most {CONTENT_MAX} characters.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="type"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Type
                    </label>
                    <select
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="announcement">Announcement</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="update">Update</option>
                      <option value="warning">Warning</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="priority"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Priority
                    </label>
                    <select
                      id="priority"
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="px-4 py-2 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                  >
                    Clear Form
                  </button>

                  {/* Send Dropdown Button */}
                  <div className="relative z-30">
                    <button
                      type="button"
                      onClick={() => setSendDropdownOpen(!sendDropdownOpen)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={
                        !formData.title.trim() ||
                        !formData.content.trim() ||
                        formData.title.trim().length < TITLE_MIN ||
                        formData.title.length > TITLE_MAX ||
                        formData.content.trim().length < CONTENT_MIN ||
                        formData.content.length > CONTENT_MAX
                      }
                    >
                      <span>Send</span>
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
                          d={
                            sendDropdownOpen
                              ? "M5 15l7-7 7 7"
                              : "M19 9l-7 7-7-7"
                          }
                        />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {sendDropdownOpen && (
                      <>
                        {/* Backdrop to close dropdown when clicking outside */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setSendDropdownOpen(false)}
                        />

                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 max-h-[400px] overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => {
                              handleSendToAll();
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                            disabled={
                              !formData.title.trim() ||
                              !formData.content.trim() ||
                              formData.title.trim().length < TITLE_MIN ||
                              formData.title.length > TITLE_MAX ||
                              formData.content.trim().length < CONTENT_MIN ||
                              formData.content.length > CONTENT_MAX
                            }
                          >
                            <UserGroupIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Send to All
                              </div>
                              <div className="text-xs text-gray-500">
                                All users in the system
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleSendMessage([
                                "Super Admin",
                                "Administrator",
                              ]);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                            disabled={
                              !formData.title.trim() ||
                              !formData.content.trim() ||
                              formData.title.trim().length < TITLE_MIN ||
                              formData.title.length > TITLE_MAX ||
                              formData.content.trim().length < CONTENT_MIN ||
                              formData.content.length > CONTENT_MAX
                            }
                          >
                            <KeyIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Send to Admins
                              </div>
                              <div className="text-xs text-gray-500">
                                Super Admin + Administrator
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleSendMessage([
                                "Super Admin",
                                "Administrator",
                                "Leader",
                              ]);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                            disabled={
                              !formData.title.trim() ||
                              !formData.content.trim() ||
                              formData.title.trim().length < TITLE_MIN ||
                              formData.title.length > TITLE_MAX ||
                              formData.content.trim().length < CONTENT_MIN ||
                              formData.content.length > CONTENT_MAX
                            }
                          >
                            <svg
                              className="w-5 h-5 text-gray-600 flex-shrink-0"
                              viewBox="0 0 512 512"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="currentColor"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <g>
                                <circle cx="268.243" cy="295.934" r="10" />
                                <circle cx="69.673" cy="144.068" r="10.02" />
                                <circle cx="140.615" cy="73.624" r="10.02" />
                                <path d="m163.434 350.156h38.501c5.534 0 10.02-4.486 10.02-10.02s-4.486-10.02-10.02-10.02h-38.501c-5.534 0-10.02 4.486-10.02 10.02s4.486 10.02 10.02 10.02z" />
                                <path d="m248.992 350.156h38.502c5.533 0 10.02-4.486 10.02-10.02s-4.486-10.02-10.02-10.02h-38.502c-5.534 0-10.02 4.486-10.02 10.02s4.486 10.02 10.02 10.02z" />
                                <path d="m334.551 350.156h38.501c5.533 0 10.02-4.486 10.02-10.02s-4.486-10.02-10.02-10.02h-38.501c-5.533 0-10.02 4.486-10.02 10.02s4.487 10.02 10.02 10.02z" />
                                <path d="m211.955 382.915c0-5.533-4.486-10.02-10.02-10.02h-38.501c-5.534 0-10.02 4.486-10.02 10.02 0 5.533 4.486 10.02 10.02 10.02h38.501c5.534-.001 10.02-4.487 10.02-10.02z" />
                                <path d="m287.494 458.454h-38.502c-5.534 0-10.02 4.486-10.02 10.02s4.486 10.02 10.02 10.02h38.502c5.533 0 10.02-4.486 10.02-10.02s-4.487-10.02-10.02-10.02z" />
                                <path d="m254.912 425.695c0-5.533-4.486-10.02-10.02-10.02h-38.501c-5.534 0-10.02 4.486-10.02 10.02 0 5.533 4.486 10.02 10.02 10.02h38.501c5.535-.001 10.02-4.487 10.02-10.02z" />
                                <path d="m281.573 425.695c0 5.533 4.486 10.02 10.02 10.02h38.502c5.533 0 10.02-4.486 10.02-10.02 0-5.533-4.486-10.02-10.02-10.02h-38.502c-5.533 0-10.02 4.486-10.02 10.02z" />
                                <path d="m248.992 392.934h38.502c5.533 0 10.02-4.486 10.02-10.02 0-5.533-4.486-10.02-10.02-10.02h-38.502c-5.534 0-10.02 4.486-10.02 10.02.001 5.534 4.486 10.02 10.02 10.02z" />
                                <path d="m334.551 392.934h38.501c5.533 0 10.02-4.486 10.02-10.02 0-5.533-4.486-10.02-10.02-10.02h-38.501c-5.533 0-10.02 4.486-10.02 10.02s4.487 10.02 10.02 10.02z" />
                                <path d="m503.756 125.154c-3.258-22.31-15.008-42.02-33.081-55.495-17.292-12.901-38.605-18.656-59.989-16.199-4.426.498-8.764 1.333-12.999 2.497-15.995-16.688-34.523-29.991-55.175-39.571-23.442-10.873-48.429-16.386-74.269-16.386-39.361 0-76.621 12.74-108.156 36.893-20.737-8.619-39.598-12.556-52.369-14.797-5.916-1.031-11.922.614-16.48 4.516-4.544 3.892-7.086 9.553-6.974 15.521.413 23.196 3.51 44.985 9.213 65.046-30.882-6.633-57.717-4.654-67.584-3.924-5.982.439-11.399 3.498-14.862 8.391-3.46 4.888-4.543 11.008-2.971 16.784 8.241 30.331 20.585 56.932 36.688 79.061.026.036.054.072.08.108.02.027.04.055.061.082 10.383 14.241 22.46 26.808 35.978 37.472-4.488 1.515-8.606 4.047-12.064 7.495-5.9 5.899-9.149 13.74-9.149 22.079 0 15.074 10.736 27.687 24.962 30.596v44.322c-.001 89.522 72.832 162.355 162.355 162.355h42.544c89.524 0 162.357-72.833 162.357-162.356v-44.318c5.95-1.207 11.419-4.127 15.812-8.519 5.899-5.898 9.149-13.74 9.149-22.08 0-16.683-13.161-30.352-29.648-31.176l40.727-55.792c13.448-18.061 19.075-40.288 15.844-62.605zm-123.17-38.582 13.797 26.264c2.566 4.877.626 11.102-4.254 13.654-4.886 2.555-11.089.633-13.652-4.25l-10.472-19.936c0-.001 10.084-12.219 14.581-15.732zm-3.803-23.127c-8.997 5.576-16.8 12.711-23.188 21.275l-71.305 97.447c-3.281-15.33-7.985-29.81-14.076-43.243-1.301-2.955-22.655-49.994-76.1-85.151-3.703-2.435-7.549-4.754-11.504-6.96 26.142-17.56 56.139-26.775 87.631-26.775 40.615.001 78.636 15.316 108.542 43.407zm-50.214 96.141 15.194 28.913c2.57 4.885.623 11.094-4.254 13.655-4.928 2.591-11.055.685-13.652-4.25l-10.689-20.348zm-85.711 70.49c-.057-.136-.116-.271-.179-.404-8.11-19.533-18.391-37.18-30.561-52.456-1.619-2.077-24.164-30.35-66.458-51.897 8.085-3.752 15.677-8.63 22.599-14.564 10.694-9.167 19.211-20.425 25.076-33.032 41.373 31.102 58.374 68.899 58.546 69.292.02.045.04.09.06.135 7.849 17.298 13.175 36.608 15.858 57.428l-22.767 30.941c-.71-1.838-1.433-3.657-2.174-5.443zm-83.369-172.484c5.877 2.648 11.548 5.593 16.949 8.781-4.664 11.196-11.9 21.178-21.222 29.169-10.639 9.121-23.266 15.096-36.864 17.533-7.538-21.354-11.594-45.31-12.092-71.24 12.85 2.254 32.348 6.34 53.229 15.757zm-56.148 72.23c.02.049.041.098.062.148-1.793 11.952-6.358 23.357-13.414 33.352-8.081 11.447-18.857 20.332-31.44 26.024-12.534-18.86-22.336-41.067-29.185-66.108 17.929-1.324 44.793-2.015 73.977 6.584zm-32.549 75.869c14.127-7.17 26.271-17.641 35.568-30.813 8.123-11.507 13.624-24.508 16.223-38.168 47.733 20.005 73.478 52.501 73.738 52.835.029.038.059.076.09.113 11.1 13.924 20.494 30.1 27.92 48.08.002.005.004.01.007.015.023.056.048.11.073.165.034.078.067.156.102.233.724 1.755 1.428 3.547 2.122 5.357h-110.407c-4.741-2.695-9.383-5.623-13.82-8.757-11.668-8.226-22.26-17.973-31.616-29.06zm388.001 69.035c0 6.094-5.094 11.189-11.188 11.189h-129.422c-5.533 0-10.02 4.486-10.02 10.02s4.486 10.02 10.02 10.02h115.65v43.69c0 78.474-63.843 142.317-142.318 142.317h-42.544c-78.474 0-142.317-63.843-142.317-142.317v-43.69h115.649c5.534 0 10.02-4.486 10.02-10.02s-4.486-10.02-10.02-10.02h-129.422c-5.571 0-10.438-4.296-11.105-9.832-.792-6.572 4.476-12.534 11.105-12.534h354.725c6.169 0 11.187 5.014 11.187 11.177zm15.023-98.906c-.021.027-.04.055-.061.081l-49.353 67.609h-160.37l36.844-50.07 7.243 13.789c5.394 10.254 15.895 16.121 26.744 16.121 16.484 0 30.162-13.825 30.116-30.27-.014-4.834-1.229-9.63-3.478-13.907l-20.884-39.74 14.153-19.234 5.965 11.356c3.744 7.133 10.043 12.379 17.738 14.772 9.4 2.923 19.791 1.003 27.551-5.045 6.829-5.322 11.066-13.546 11.53-22.185.289-5.393-.92-10.808-3.433-15.585l-14.001-26.652c4.759-1.732 9.71-2.913 14.829-3.489 16.317-1.871 32.561 2.514 45.747 12.35 13.787 10.28 22.748 25.312 25.231 42.317 2.464 17.03-1.836 34-12.111 47.782z" />
                                <path d="m143.724 200.837c3.239 2.24 12.607 9.412 17.002 15.613 3.418 4.82 10.483 5.605 14.883 1.649 3.731-3.355 4.364-9.149 1.465-13.238-7.194-10.148-20.462-19.475-21.951-20.505-4.551-3.148-10.792-2.01-13.94 2.541-3.148 4.55-2.011 10.792 2.541 13.94z" />
                              </g>
                            </svg>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Send to @Cloud co-workers
                              </div>
                              <div className="text-xs text-gray-500">
                                Super Admin + Administrator + Leader
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleSendMessage(["Guest Expert"]);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                            disabled={
                              !formData.title.trim() ||
                              !formData.content.trim() ||
                              formData.title.trim().length < TITLE_MIN ||
                              formData.title.length > TITLE_MAX ||
                              formData.content.trim().length < CONTENT_MIN ||
                              formData.content.length > CONTENT_MAX
                            }
                          >
                            <AcademicCapIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Send to Guest Experts
                              </div>
                              <div className="text-xs text-gray-500">
                                Guest Expert role only
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleSendMessage(["Participant"]);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                            disabled={
                              !formData.title.trim() ||
                              !formData.content.trim() ||
                              formData.title.trim().length < TITLE_MIN ||
                              formData.title.length > TITLE_MAX ||
                              formData.content.trim().length < CONTENT_MIN ||
                              formData.content.length > CONTENT_MAX
                            }
                          >
                            <UserIcon className="w-5 h-5 text-gray-600 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Send to Participants
                              </div>
                              <div className="text-xs text-gray-500">
                                Participant role only
                              </div>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={cancelDeleteMessage}
        onConfirm={confirmDeleteMessage}
        title="Delete System Message"
        message={`Are you sure you want to delete "${deleteConfirmation.messageTitle}"?\n\nThis action cannot be undone.`}
        confirmText="Delete Message"
        type="danger"
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}
