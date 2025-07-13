import React, { useEffect, useState } from "react";
import { useSocket } from "../../hooks/useSocket";
import { Icon } from "../common";

interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const RealTimeNotificationToast: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationToast[]>([]);
  const { onNewMessage, onEventUpdate } = useSocket();

  useEffect(() => {
    // Listen for new messages
    const unsubscribeMessages = onNewMessage((message) => {
      const notification: NotificationToast = {
        id: `msg-${Date.now()}`,
        title: "New Message",
        message: `${message.senderName}: ${message.content.substring(0, 50)}${
          message.content.length > 50 ? "..." : ""
        }`,
        type: "info",
        duration: 5000,
        action: {
          label: "View",
          onClick: () => {
            // Navigate to chat
            window.location.href = `/dashboard/chat/${message.senderId}`;
          },
        },
      };

      setNotifications((prev) => [...prev, notification]);
    });

    // Listen for event updates
    const unsubscribeEvents = onEventUpdate((update) => {
      const notification: NotificationToast = {
        id: `event-${Date.now()}`,
        title: "Event Update",
        message: `${update.eventTitle}: ${update.message}`,
        type: update.type === "reminder" ? "warning" : "info",
        duration: 7000,
        action: {
          label: "View Event",
          onClick: () => {
            window.location.href = `/dashboard/events/${update.eventId}`;
          },
        },
      };

      setNotifications((prev) => [...prev, notification]);
    });

    return () => {
      unsubscribeMessages();
      unsubscribeEvents();
    };
  }, [onNewMessage, onEventUpdate]);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const getIconForType = (
    type: NotificationToast["type"]
  ): "check-circle" | "x-circle" | "shield-check" | "chat-bubble" => {
    switch (type) {
      case "success":
        return "check-circle";
      case "warning":
        return "shield-check";
      case "error":
        return "x-circle";
      default:
        return "chat-bubble";
    }
  };

  const getColorForType = (type: NotificationToast["type"]) => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200 text-green-800";
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "error":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-blue-50 border-blue-200 text-blue-800";
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onRemove={removeNotification}
          getIconForType={getIconForType}
          getColorForType={getColorForType}
        />
      ))}
    </div>
  );
};

interface NotificationCardProps {
  notification: NotificationToast;
  onRemove: (id: string) => void;
  getIconForType: (type: NotificationToast["type"]) => string;
  getColorForType: (type: NotificationToast["type"]) => string;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onRemove,
  getIconForType,
  getColorForType,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slide in animation
    setTimeout(() => setIsVisible(true), 100);

    // Auto-remove after duration
    if (notification.duration) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onRemove(notification.id), 300);
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification.duration, notification.id, onRemove]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(notification.id), 300);
  };

  return (
    <div
      className={`transform transition-all duration-300 ease-in-out ${
        isVisible
          ? "translate-x-0 opacity-100 scale-100"
          : "translate-x-full opacity-0 scale-95"
      }`}
    >
      <div
        className={`border rounded-lg shadow-lg p-4 min-w-0 ${getColorForType(
          notification.type
        )}`}
      >
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Icon
              name={getIconForType(notification.type)}
              className="w-5 h-5"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold truncate">
                {notification.title}
              </h4>
              <button
                onClick={handleClose}
                className="ml-2 flex-shrink-0 opacity-60 hover:opacity-100"
              >
                <Icon name="x-mark" className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs mt-1 leading-relaxed">
              {notification.message}
            </p>

            {notification.action && (
              <button
                onClick={() => {
                  notification.action!.onClick();
                  handleClose();
                }}
                className="mt-2 text-xs font-medium underline hover:no-underline"
              >
                {notification.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeNotificationToast;
