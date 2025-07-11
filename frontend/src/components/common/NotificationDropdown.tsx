import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BellIcon } from "@heroicons/react/24/outline";
import { Icon } from "../common";
import { useNotifications } from "../../contexts/NotificationContext";
import { getAvatarUrl } from "../../utils/avatarUtils";

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
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

  const handleNotificationClick = (notification: any) => {
    // Mark as read
    if (notification.systemMessage) {
      // This is a system message, mark it as read in the system messages
      markSystemMessageAsRead(notification.id);
    } else {
      // This is a regular notification
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case "system":
        // Navigate to system messages page with hash to scroll to specific message
        navigate(`/dashboard/system-messages#${notification.id}`);
        break;
      case "user_message":
        navigate(`/dashboard/chat/${notification.fromUser?.id}`);
        break;
      case "management_action":
        // Could navigate to a specific page or just mark as read
        break;
    }

    setIsOpen(false);
  };

  const handleDeleteNotification = (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation(); // Prevent triggering the notification click
    removeNotification(notificationId);
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

  const getSystemMessageTypeIcon = (type: string) => {
    switch (type) {
      case "announcement":
        return <Icon name="lightning" className="w-4 h-4 text-blue-600" />;
      case "maintenance":
        return (
          <Icon name="shield-check" className="w-4 h-4 text-emerald-600" />
        );
      case "update":
        return <Icon name="check-circle" className="w-4 h-4 text-green-600" />;
      case "warning":
        return <Icon name="x-circle" className="w-4 h-4 text-red-600" />;
      default:
        return <Icon name="lightning" className="w-4 h-4 text-blue-600" />;
    }
  };

  const getSystemMessageTypeBadge = (type: string) => {
    switch (type) {
      case "announcement":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            📢 Announcement
          </span>
        );
      case "maintenance":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            🛡️ Maintenance
          </span>
        );
      case "update":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            ✅ Update
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            ⚠️ Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            📢 System
          </span>
        );
    }
  };

  const renderNotificationContent = (notification: any) => {
    switch (notification.type) {
      case "system":
        return (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {notification.systemMessage?.creator ? (
                <img
                  className="w-8 h-8 rounded-full"
                  src={getAvatarUrl(
                    notification.systemMessage.creator.avatar || null,
                    notification.systemMessage.creator.gender
                  )}
                  alt={`${notification.systemMessage.creator.firstName} ${notification.systemMessage.creator.lastName}`}
                />
              ) : (
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  {getSystemMessageTypeIcon(
                    notification.systemMessage?.type || "announcement"
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-gray-900 break-words flex-1">
                  {notification.systemMessage?.creator
                    ? `${notification.systemMessage.creator.firstName} ${notification.systemMessage.creator.lastName}`
                    : notification.title}
                </p>
                <div className="flex-shrink-0">
                  {getSystemMessageTypeBadge(
                    notification.systemMessage?.type || "announcement"
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 break-words leading-relaxed">
                {notification.systemMessage?.creator
                  ? notification.title
                  : notification.message}
              </p>
              {notification.systemMessage?.creator?.roleInAtCloud && (
                <p className="text-xs text-gray-400 mt-1">
                  {notification.systemMessage.creator.roleInAtCloud}
                </p>
              )}
            </div>
          </div>
        );

      case "user_message":
        return (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <img
                className="w-8 h-8 rounded-full"
                src={getAvatarUrl(
                  notification.fromUser?.avatar,
                  notification.fromUser?.gender
                )}
                alt={`${notification.fromUser?.firstName} ${notification.fromUser?.lastName}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-gray-900 break-words flex-1">
                  {notification.fromUser?.firstName}{" "}
                  {notification.fromUser?.lastName}
                </p>
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    💬 Chat
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 break-words leading-relaxed">
                {notification.message.length > 80
                  ? `${notification.message.substring(0, 80)}...`
                  : notification.message}
              </p>
            </div>
          </div>
        );

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
        return null;
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
                onClick={() => {
                  markAllAsRead();
                  setIsOpen(false);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {allNotifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500">
                <BellIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No notifications</p>
              </div>
            ) : (
              allNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200 ${
                    !notification.isRead ? "bg-blue-50" : ""
                  }`}
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
                        {/* Delete button - show for read notifications or management actions */}
                        {(notification.isRead ||
                          notification.type === "management_action") && (
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
