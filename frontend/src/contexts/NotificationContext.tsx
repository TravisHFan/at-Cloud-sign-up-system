import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useToastReplacement } from "./NotificationModalContext";
import type { Notification, SystemMessage } from "../types/notification";
import {
  getAllUsers as getCentralizedUsers,
  getUserById,
} from "../data/mockUserData";
import { notificationService } from "../services/notificationService";
import { systemMessageService } from "../services/systemMessageService";
import { authService } from "../services/api";
import type { SystemAuthorizationLevel } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";

interface NotificationContextType {
  // Notifications (for bell dropdown - includes system messages)
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (
    notification: Omit<Notification, "id" | "createdAt">
  ) => void;
  removeNotification: (notificationId: string) => Promise<void>;

  // Combined notifications for bell dropdown (includes system messages converted to notifications)
  allNotifications: Notification[];
  totalUnreadCount: number;

  // System Messages (for dedicated system messages page)
  systemMessages: SystemMessage[];
  markSystemMessageAsRead: (messageId: string) => Promise<void>;
  reloadSystemMessages: () => Promise<void>;
  addSystemMessage: (
    message: Omit<SystemMessage, "id" | "createdAt">
  ) => Promise<void>;
  addAutoSystemMessage: (
    message: Omit<SystemMessage, "id" | "createdAt">
  ) => Promise<void>;
  deleteSystemMessage: (messageId: string) => void;
  addRoleChangeSystemMessage: (data: {
    targetUserName: string;
    targetUserId: string;
    fromSystemAuthLevel: string;
    toSystemAuthLevel: string;
    actorUserId: string;
    actorName: string;
  }) => void;

  // User management
  getAllUsers: () => Array<{
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: "male" | "female";
  }>;
  getUserById: (userId: string) =>
    | {
        id: string;
        firstName: string;
        lastName: string;
        username: string;
        avatar?: string;
        gender: "male" | "female";
      }
    | undefined;

  // Event reminder functionality
  scheduleEventReminder: (eventData: {
    id: string;
    title: string;
    date: string;
    time: string;
    endTime: string;
    location: string;
  }) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const notification = useToastReplacement();
  const { currentUser, updateUser } = useAuth();
  const socket = useSocket();

  // Load system messages from backend
  const loadSystemMessages = async () => {
    try {
      if (!currentUser) return;

      const data = await systemMessageService.getSystemMessages();

      const processedMessages = data.map((message: any) => ({
        ...message,
        createdAt: message.createdAt || new Date().toISOString(),
      }));

      setSystemMessages(processedMessages);
    } catch (error) {
      console.error("Failed to load system messages:", error);
    }
  };

  // Load notifications from backend
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        if (!currentUser) return;

        const data = await notificationService.getNotifications();
        const processedNotifications = data.map((notification: any) => ({
          ...notification,
          createdAt: notification.createdAt || new Date().toISOString(),
        }));

        setNotifications(processedNotifications);
      } catch (error) {
        console.error("Failed to load notifications:", error);
      }
    };

    loadNotifications();
  }, [currentUser]);

  // Load system messages on user change
  useEffect(() => {
    loadSystemMessages();
  }, [currentUser]);

  // Real-time WebSocket listeners for instant updates
  useEffect(() => {
    if (!currentUser || !socket?.socket) return;

    const handleSystemMessageUpdate = (update: any) => {
      switch (update.event) {
        case "message_created":
          const messageId = update.data.message.id;

          // Handle new system message creation
          const newMessage: SystemMessage = {
            id: messageId,
            title: update.data.message.title,
            content: update.data.message.content,
            type: update.data.message.type,
            priority: update.data.message.priority,
            creator: update.data.message.creator,
            createdAt: update.data.message.createdAt,
            targetUserId: update.data.message.targetUserId,
            isRead: false,
            metadata: update.data.message.metadata,
          };

          setSystemMessages((prev) => {
            // Check if message already exists to avoid duplicates
            const exists = prev.some((msg) => msg.id === newMessage.id);
            if (exists) return prev;

            return [newMessage, ...prev];
          });

          // ✅ UNIFIED: Create bell notification from system message
          const bellNotification: Notification = {
            id: messageId,
            type: "SYSTEM_MESSAGE" as const,
            title: newMessage.title,
            message: newMessage.content,
            isRead: false,
            createdAt: newMessage.createdAt,
            userId: "",
            systemMessage: {
              id: messageId,
              type: newMessage.type,
              creator: newMessage.creator
                ? {
                    firstName: newMessage.creator.firstName,
                    lastName: newMessage.creator.lastName,
                    authLevel: newMessage.creator.authLevel,
                    roleInAtCloud: newMessage.creator.roleInAtCloud,
                  }
                : undefined,
            },
            eventId: newMessage.metadata?.eventId,
          };

          setNotifications((prev) => {
            // Check if notification already exists to avoid duplicates
            const exists = prev.some(
              (notif) => notif.id === bellNotification.id
            );
            if (exists) return prev;

            return [bellNotification, ...prev];
          });

          // If this is a system authorization level change targeting this user,
          // refresh the authenticated profile and update permissions immediately.
          if (update.data.message.type === "auth_level_change") {
            (async () => {
              try {
                const profile = await authService.getProfile();
                updateUser({
                  role: profile.role as SystemAuthorizationLevel,
                  isAtCloudLeader: profile.isAtCloudLeader ? "Yes" : "No",
                  roleInAtCloud: profile.roleInAtCloud,
                });
              } catch (e) {
                console.error(
                  "Failed to refresh profile after role change:",
                  e
                );
              }
            })();
          }

          // Show toast notification (except for role change events which are handled by EventDetail)
          if (
            update.data.message.type !== "atcloud_role_change" &&
            update.data.message.type !== "event_role_change"
          ) {
            notification.info(
              `New ${update.data.message.type}: ${update.data.message.title}`,
              {
                title: "System Message",
                autoCloseDelay: 5000,
              }
            );
          }
          break;
        case "message_read":
          setSystemMessages((prev) =>
            prev.map((msg) =>
              msg.id === update.data.messageId
                ? { ...msg, isRead: true, readAt: update.data.readAt }
                : msg
            )
          );
          break;
        case "message_deleted":
          setSystemMessages((prev) =>
            prev.filter((msg) => msg.id !== update.data.messageId)
          );
          break;
      }
    };

    const handleBellNotificationUpdate = (update: any) => {
      // ✅ SIMPLIFIED: Since system messages now handle bell notification creation,
      // this handler only processes direct bell notification events (read/remove)
      switch (update.event) {
        case "notification_read":
          setNotifications((prev) =>
            prev.map((notification) =>
              notification.id === update.data.messageId
                ? { ...notification, isRead: true, readAt: update.data.readAt }
                : notification
            )
          );
          break;
        case "notification_removed":
          setNotifications((prev) =>
            prev.filter(
              (notification) => notification.id !== update.data.messageId
            )
          );
          break;
      }
    };

    const handleUnreadCountUpdate = async () => {
      // Refresh notifications to ensure the UI is consistent with the new counts
      try {
        const data = await notificationService.getNotifications();
        const processedNotifications = data.map((notification: any) => ({
          ...notification,
          createdAt: notification.createdAt || new Date().toISOString(),
        }));
        setNotifications(processedNotifications);
      } catch (error) {
        console.error(
          "Failed to refresh notifications after count update:",
          error
        );
      }
    };

    // Add event listeners - only once per socket connection
    const socketInstance = socket.socket;

    // Remove any existing listeners first to prevent duplicates
    socketInstance.off("system_message_update");
    socketInstance.off("bell_notification_update");
    socketInstance.off("unread_count_update");

    socketInstance.on("system_message_update", handleSystemMessageUpdate);
    socketInstance.on("bell_notification_update", handleBellNotificationUpdate);
    socketInstance.on("unread_count_update", handleUnreadCountUpdate);

    // On reconnect, fetch the latest messages to avoid missing any while offline
    const handleReconnect = async () => {
      try {
        await loadSystemMessages();
        const data = await notificationService.getNotifications();
        const processed = data.map((n: any) => ({
          ...n,
          createdAt: n.createdAt || new Date().toISOString(),
        }));
        setNotifications(processed);
      } catch (err) {
        console.error("Failed to refresh after reconnect:", err);
      }
    };
    socketInstance.on("connect", handleReconnect);

    // Cleanup on unmount or dependency change
    return () => {
      socketInstance.off("system_message_update", handleSystemMessageUpdate);
      socketInstance.off(
        "bell_notification_update",
        handleBellNotificationUpdate
      );
      socketInstance.off("unread_count_update", handleUnreadCountUpdate);
      socketInstance.off("connect", handleReconnect);
    };
  }, [currentUser?.id, socket?.connected]);

  const markAsRead = async (notificationId: string) => {
    try {
      // Only make the API call - let WebSocket events handle all UI updates
      await notificationService.markAsRead(notificationId);
      // Removed manual state updates and loadSystemMessages() call
      // WebSocket events will handle:
      // - Bell notification read status update
      // - System message read status update (if applicable)
      // - Unread count updates
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      notification.error("Failed to mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      // Only make the API call - let WebSocket events handle all UI updates
      await notificationService.markAllAsRead();
      // Removed manual state updates and loadSystemMessages() call
      // WebSocket events will handle:
      // - All bell notifications marked as read
      // - All system messages marked as read (if applicable)
      // - Unread count updates
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      notification.error("Failed to mark all notifications as read");
    }
  };

  const addNotification = (
    notification: Omit<Notification, "id" | "createdAt">
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: `local-${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
    };

    setNotifications((prev) => [newNotification, ...prev]);
  };

  const removeNotification = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      // Refresh system messages to get updated bell notification states
      await loadSystemMessages();
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== notificationId)
      );
    } catch (error) {
      console.error("Failed to remove notification:", error);
      notification.error("Failed to remove notification");
    }
  };

  const markSystemMessageAsRead = async (messageId: string) => {
    try {
      // Only make the API call - let WebSocket events handle all UI updates
      await systemMessageService.markAsRead(messageId);

      // TEMPORARY: Add immediate manual state update to fix the UI issue
      // Remove this once WebSocket events are confirmed working
      setSystemMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, isRead: true, readAt: new Date().toISOString() }
            : msg
        )
      );

      // Also update the corresponding bell notification to decrease the count immediately
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === messageId
            ? {
                ...notification,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : notification
        )
      );

      // Removed manual state updates - WebSocket events will handle:
      // - System message read status update
      // - Bell notification read status update
      // - Unread count updates
    } catch (error) {
      console.error("Failed to mark system message as read:", error);
      notification.error("Failed to mark system message as read");
    }
  };

  const addSystemMessage = async (
    _message: Omit<SystemMessage, "id" | "createdAt">
  ): Promise<void> => {
    console.warn(
      "System messages should be created server-side by admin operations"
    );
    console.warn("This method is deprecated in user-centric architecture");
    console.warn(
      "System messages will automatically appear in user documents when created by admin"
    );
    throw new Error(
      "System message creation not supported in user-centric mode"
    );
  };

  const addAutoSystemMessage = async (
    _message: Omit<SystemMessage, "id" | "createdAt">
  ): Promise<void> => {
    console.warn("Auto system messages should be created server-side");
    console.warn("This method is deprecated in user-centric architecture");
    console.warn(
      "System messages will automatically appear in user documents when created by server"
    );
  };

  const deleteSystemMessage = (_messageId: string) => {
    console.warn(
      "System message deletion should be handled server-side by admin operations"
    );
    console.warn("This method is deprecated in user-centric architecture");
  };

  const addRoleChangeSystemMessage = (_data: {
    targetUserName: string;
    targetUserId: string;
    fromSystemAuthLevel: string;
    toSystemAuthLevel: string;
    actorUserId: string;
    actorName: string;
  }) => {
    console.warn(
      "Role change system messages should be created server-side during role update operations"
    );
    console.warn("This method is deprecated in user-centric architecture");
    console.warn(
      "System messages will automatically appear in user documents when roles are changed server-side"
    );
  };

  const getAllUsers = () => {
    return getCentralizedUsers().map((user) => ({
      ...user,
      avatar: user.avatar || undefined, // Convert null to undefined
    }));
  };

  const getUserByIdWrapper = (userId: string) => {
    const user = getUserById(userId);
    if (!user) return undefined;
    return {
      ...user,
      avatar: user.avatar || undefined, // Convert null to undefined
    };
  };

  const scheduleEventReminder = (eventData: {
    id: string;
    title: string;
    date: string;
    time: string;
    endTime: string;
    location: string;
  }) => {
    const reminderTime = new Date(eventData.date + "T" + eventData.time);
    const now = new Date();

    if (reminderTime > now) {
      const timeUntilReminder = reminderTime.getTime() - now.getTime();

      setTimeout(() => {
        const notification: Omit<Notification, "id" | "createdAt"> = {
          type: "EVENT_REMINDER",
          title: "Event Reminder",
          message: `${eventData.title} starts in 15 minutes at ${eventData.location}`,
          isRead: false,
          userId: currentUser?.id || "",
          eventId: eventData.id,
        };
        addNotification(notification);
      }, Math.max(0, timeUntilReminder - 15 * 60 * 1000)); // 15 minutes before
    }
  };

  // Compute values
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  // Use only bell notifications for the dropdown - they already include system messages
  // The unified system provides bell notifications that are the canonical source for the bell dropdown
  const allNotifications = notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Use only bell notifications for total count - they already include all relevant notifications
  const totalUnreadCount = unreadCount;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
        removeNotification,
        allNotifications,
        totalUnreadCount,
        systemMessages,
        markSystemMessageAsRead,
        reloadSystemMessages: loadSystemMessages,
        addSystemMessage,
        addAutoSystemMessage,
        addRoleChangeSystemMessage,
        deleteSystemMessage,
        getAllUsers,
        getUserById: getUserByIdWrapper,
        scheduleEventReminder,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
}
