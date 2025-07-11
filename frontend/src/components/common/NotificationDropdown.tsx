import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../common";
import { useNotifications } from "../../contexts/NotificationContext";
import { getAvatarUrl } from "../../utils/avatarUtils";

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: any) => {
    // Mark as read
    markAsRead(notification.id);
    
    // Navigate based on notification type
    switch (notification.type) {
      case "system":
        navigate("/dashboard/system-messages");
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const renderNotificationContent = (notification: any) => {
    switch (notification.type) {
      case "system":
        return (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Icon name="lightning" className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{notification.title}</p>
              <p className="text-sm text-gray-500 truncate">{notification.message}</p>
            </div>
          </div>
        );
        
      case "user_message":
        return (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <img
                className="w-8 h-8 rounded-full"
                src={getAvatarUrl(notification.fromUser?.avatar, notification.fromUser?.gender)}
                alt={`${notification.fromUser?.firstName} ${notification.fromUser?.lastName}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {notification.fromUser?.firstName} {notification.fromUser?.lastName}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {notification.message.length > 50 
                  ? `${notification.message.substring(0, 50)}...` 
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
              <p className="text-sm font-medium text-gray-900">{notification.title}</p>
              <p className="text-sm text-gray-500 truncate">{notification.message}</p>
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
        <Icon name="bell" className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
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
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500">
                <Icon name="bell" className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors duration-200 ${
                    !notification.isRead ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {renderNotificationContent(notification)}
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      <span className="text-xs text-gray-400">
                        {formatTime(notification.createdAt)}
                      </span>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 ml-auto"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => {
                  navigate("/dashboard/notifications");
                  setIsOpen(false);
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
