import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BellIcon } from "@heroicons/react/24/outline";
import { Icon } from "../common";
import { useNotifications } from "../../contexts/NotificationContext";
import { getAvatarUrl } from "../../utils/avatarUtils";
import type { Notification } from "../../types/notification";

export default function EnhancedNotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [autoHideTimer, setAutoHideTimer] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    allNotifications,
    totalUnreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    markSystemMessageAsRead,
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-hide notifications after 5 seconds for low priority
  useEffect(() => {
    if (isOpen && allNotifications.length > 0) {
      // Note: Adjusting for current implementation where type might be "user_message"
      const lowPriorityNotifications = allNotifications.filter((n) => {
        const isLowPriority = (n as any).priority === "low";
        const isChatMessage = n.type === "user_message";
        return isLowPriority && !n.isRead && isChatMessage;
      });

      if (lowPriorityNotifications.length > 0) {
        const timer = setTimeout(() => {
          lowPriorityNotifications.forEach((notification) => {
            handleNotificationClick(notification, true); // Auto-dismiss
          });
        }, 5000); // 5 seconds

        setAutoHideTimer(timer);
      }
    }

    return () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [isOpen, allNotifications]);

  const handleNotificationClick = async (
    notification: Notification,
    autoDismiss = false
  ) => {
    try {
      // Mark as read
      if (notification.type === "SYSTEM_MESSAGE") {
        await markSystemMessageAsRead(notification.id);
      } else {
        await markAsRead(notification.id);
      }

      // Navigate only if not auto-dismissing
      if (!autoDismiss) {
        switch (notification.type) {
          case "SYSTEM_MESSAGE":
          case "system":
            // Navigate to system messages page with hash to scroll to specific message
            navigate(`/dashboard/system-messages#${notification.id}`);
            break;
          case "user_message":
            if (notification.fromUser?.id) {
              navigate(`/dashboard/chat/${notification.fromUser.id}`);
            } else {
              console.warn("⚠️ Cannot navigate to chat: missing fromUser.id");
              navigate("/dashboard/chat");
            }
            break;
          case "USER_ACTION":
          case "management_action":
            // Could navigate to a specific page or just mark as read
            break;
          default:
            console.warn("⚠️ Unknown notification type:", notification.type);
            break;
        }
        setIsOpen(false);
      }
    } catch (error) {
      console.error("💥 Error handling notification click:", error);
    }
  };

  const handleDeleteNotification = async (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation(); // Prevent triggering the notification click
    await removeNotification(notificationId);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Get system message type icon with proper colors
  const getSystemMessageTypeIcon = (type: string) => {
    switch (type) {
      case "announcement":
        return (
          <img
            src="/marketing.svg"
            alt="Marketing"
            className="w-5 h-5"
            style={{
              filter:
                "brightness(0) saturate(100%) invert(26%) sepia(94%) saturate(6338%) hue-rotate(212deg) brightness(99%) contrast(91%)",
            }}
          />
        );
      case "maintenance":
        return <Icon name="shield-check" className="w-4 h-4 text-orange-400" />;
      case "update":
        return <Icon name="check-circle" className="w-4 h-4 text-green-600" />;
      case "warning":
        return <Icon name="x-circle" className="w-4 h-4 text-red-600" />;
      case "auth_level_change":
        return <Icon name="user" className="w-4 h-4 text-green-600" />;
      default:
        return (
          <img
            src="/marketing.svg"
            alt="Marketing"
            className="w-5 h-5"
            style={{
              filter:
                "brightness(0) saturate(100%) invert(26%) sepia(94%) saturate(6338%) hue-rotate(212deg) brightness(99%) contrast(91%)",
            }}
          />
        );
    }
  };

  // Get priority-based styling
  const getPriorityClass = (priority: string, isRead: boolean) => {
    if (isRead) return "bg-gray-50";

    switch (priority) {
      case "high":
        return "bg-red-50 border-l-4 border-red-500";
      case "medium":
        return "bg-blue-50 border-l-4 border-blue-500";
      case "low":
        return "bg-green-50 border-l-4 border-green-500";
      default:
        return "bg-blue-50";
    }
  };

  const renderNotificationContent = (notification: Notification) => {
    // Check for empty content
    if (!notification.title && !notification.message) {
      console.warn("⚠️ Empty notification detected:", notification);
      return (
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-xs">!</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-600 break-words">
              Empty Notification
            </p>
            <p className="text-sm text-gray-500 break-words leading-relaxed">
              This notification has no content (ID: {notification.id})
            </p>
          </div>
        </div>
      );
    }

    switch (notification.type) {
      case "SYSTEM_MESSAGE":
      case "system":
        // Special handling for auth level change messages
        if (notification.systemMessage?.type === "auth_level_change") {
          return (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  {getSystemMessageTypeIcon("auth_level_change")}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 break-words">
                  {notification.title}
                </p>
                <p className="text-sm text-gray-500 break-words leading-relaxed">
                  System Authorization Level Update
                </p>
              </div>
            </div>
          );
        }

        // Regular system messages with creator info and icon
        return (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                {getSystemMessageTypeIcon(
                  notification.systemMessage?.type || "announcement"
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 break-words">
                {notification.title}
              </p>
              <p className="text-sm text-gray-500 break-words leading-relaxed">
                {notification.message.length > 80
                  ? `${notification.message.substring(0, 80)}...`
                  : notification.message}
              </p>
              {notification.systemMessage?.creator && (
                <p className="text-xs text-gray-400 mt-1">
                  From: {notification.systemMessage.creator.firstName}{" "}
                  {notification.systemMessage.creator.lastName}
                  {notification.systemMessage.creator.roleInAtCloud &&
                    ` • ${notification.systemMessage.creator.roleInAtCloud}`}
                </p>
              )}
            </div>
          </div>
        );

      case "CHAT_MESSAGE":
      case "user_message":
        return (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <img
                className="w-8 h-8 rounded-full"
                src={getAvatarUrl(
                  notification.fromUser?.avatar || null,
                  notification.fromUser?.gender || "male"
                )}
                alt={`${notification.fromUser?.firstName} ${notification.fromUser?.lastName}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 break-words">
                {notification.fromUser?.firstName}{" "}
                {notification.fromUser?.lastName}
              </p>
              <p className="text-sm text-gray-500 break-words leading-relaxed">
                {notification.message.length > 80
                  ? `${notification.message.substring(0, 80)}...`
                  : notification.message}
              </p>
            </div>
          </div>
        );

      case "USER_ACTION":
      case "management_action":
        return (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Icon name="user" className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 break-words">
                {notification.title}
              </p>
              <p className="text-sm text-gray-500 break-words leading-relaxed">
                {notification.message}
              </p>
            </div>
          </div>
        );

      default:
        console.warn("⚠️ Unknown notification type:", notification.type);
        // Fallback rendering for unknown types
        return (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <Icon name="chat-bubble" className="w-4 h-4 text-gray-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 break-words">
                {notification.title || "Notification"}
              </p>
              <p className="text-sm text-gray-500 break-words leading-relaxed">
                {notification.message || "No content available"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Type: {notification.type}
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
      >
        <BellIcon className="w-6 h-6" />
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
            {totalUnreadCount > 0 && (
              <button
                onClick={async () => {
                  await markAllAsRead();
                  setIsOpen(false);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-64 sm:max-h-80 md:max-h-96 lg:max-h-[32rem] overflow-y-auto">
            {allNotifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500">
                <BellIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No notifications</p>
              </div>
            ) : (
              allNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200 ${getPriorityClass(
                    notification.priority || "medium",
                    notification.isRead
                  )}`}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 pr-2 cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {renderNotificationContent(notification)}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end space-y-1">
                      <span className="text-xs text-gray-400">
                        {formatTime(notification.createdAt)}
                      </span>
                      <div className="flex items-center space-x-1">
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                        {/* Priority indicator */}
                        {(notification.priority === "high" ||
                          (notification as any).priority === "high") && (
                          <div
                            className="w-2 h-2 bg-red-500 rounded-full"
                            title="High priority"
                          ></div>
                        )}
                        {/* Remove button - only show for READ notifications and CHAT messages */}
                        {(notification.isRead ||
                          notification.type === "user_message" ||
                          notification.type === "CHAT_MESSAGE") && (
                          <button
                            onClick={(e) =>
                              handleDeleteNotification(e, notification.id)
                            }
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
                            title="Remove notification"
                          >
                            <Icon name="x-mark" className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
