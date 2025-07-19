import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import type { Notification, SystemMessage } from "../types/notification";
import {
  getAllUsers as getCentralizedUsers,
  getUserById,
} from "../data/mockUserData";
import { notificationService } from "../services/notificationService";
import { systemMessageService } from "../services/systemMessageService";
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

// Remove mock notifications - we now use backend data exclusively
const mockNotifications: Notification[] = [];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const socket = useSocket();

  const [notifications, setNotifications] =
    useState<Notification[]>(mockNotifications);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);

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

  // Auto-refresh notifications periodically
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      try {
        const data = await notificationService.getNotifications();
        const processedNotifications = data.map((notification: any) => ({
          ...notification,
          createdAt: notification.createdAt || new Date().toISOString(),
        }));

        setNotifications(processedNotifications);
      } catch (error) {
        console.error("Failed to refresh notifications:", error);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [currentUser]);

  // Real-time WebSocket listeners for instant updates
  useEffect(() => {
    if (!currentUser || !socket?.socket) return;

    const handleSystemMessageUpdate = (update: any) => {
      console.log("📨 Real-time system message update:", update);

      switch (update.event) {
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
      console.log("🔔 Real-time bell notification update:", update);

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

    const handleUnreadCountUpdate = async (update: any) => {
      console.log("📊 Real-time unread count update:", update);

      // Refresh notifications to ensure the UI is consistent with the new counts
      // This will trigger a re-render with the updated unread counts
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

    const handleNewSystemMessage = (data: any) => {
      console.log("📢 New system message received:", data);
      console.log("🎯 DEBUG: Current user ID:", currentUser?.id);
      console.log("🎯 DEBUG: Message creator:", data.data.creator);
      console.log(
        "🎯 DEBUG: Current systemMessages count before:",
        systemMessages.length
      );

      const newMessage: SystemMessage = {
        id: data.data.id,
        title: data.data.title,
        content: data.data.content,
        type: data.data.type,
        priority: data.data.priority,
        creator: data.data.creator,
        createdAt: data.data.createdAt,
        isRead: false,
      };

      setSystemMessages((prev) => {
        const updated = [newMessage, ...prev];
        console.log("🎯 DEBUG: Updated systemMessages count:", updated.length);
        console.log("🎯 DEBUG: New message added:", newMessage.title);
        return updated;
      });

      // Also add as bell notification
      const newNotification: Notification = {
        id: data.data.id,
        title: data.data.title,
        message: data.data.content,
        type: "SYSTEM_MESSAGE",
        priority: data.data.priority,
        createdAt: data.data.createdAt,
        isRead: false,
        userId: currentUser.id,
        systemMessage: {
          id: data.data.id,
          type: data.data.type,
          creator: data.data.creator,
        },
      };

      setNotifications((prev) => {
        const updated = [newNotification, ...prev];
        console.log("🎯 DEBUG: Updated notifications count:", updated.length);
        return updated;
      });

      // Show toast notification for new messages
      toast(`New ${data.data.type}: ${data.data.title}`, {
        duration: 5000,
        icon: "📨",
      });
    };

    // Add event listeners
    socket.socket.on("system_message_update", handleSystemMessageUpdate);
    socket.socket.on("bell_notification_update", handleBellNotificationUpdate);
    socket.socket.on("new_system_message", handleNewSystemMessage);
    socket.socket.on("unread_count_update", handleUnreadCountUpdate);

    // Cleanup on unmount
    return () => {
      if (socket?.socket) {
        socket.socket.off("system_message_update", handleSystemMessageUpdate);
        socket.socket.off(
          "bell_notification_update",
          handleBellNotificationUpdate
        );
        socket.socket.off("new_system_message", handleNewSystemMessage);
        socket.socket.off("unread_count_update", handleUnreadCountUpdate);
      }
    };
  }, [currentUser, socket?.socket]);

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
      toast.error("Failed to mark notification as read");
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
      toast.error("Failed to mark all notifications as read");
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
      toast.error("Failed to remove notification");
    }
  };

  const markSystemMessageAsRead = async (messageId: string) => {
    try {
      console.log(
        "🎯 DEBUG: markSystemMessageAsRead called for messageId:",
        messageId
      );
      console.log(
        "🎯 DEBUG: Current socket connection status:",
        socket?.socket?.connected
      );

      // Only make the API call - let WebSocket events handle all UI updates
      await systemMessageService.markAsRead(messageId);
      console.log("🎯 DEBUG: API call completed successfully");

      // TEMPORARY: Add immediate manual state update to fix the UI issue
      // Remove this once WebSocket events are confirmed working
      setSystemMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, isRead: true, readAt: new Date().toISOString() }
            : msg
        )
      );
      console.log("🎯 DEBUG: Manual system message state update applied");

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
      console.log("🎯 DEBUG: Manual bell notification state update applied");

      // Removed manual state updates - WebSocket events will handle:
      // - System message read status update
      // - Bell notification read status update
      // - Unread count updates
    } catch (error) {
      console.error("Failed to mark system message as read:", error);
      toast.error("Failed to mark system message as read");
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

  const addRoleChangeSystemMessage = (data: {
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
    console.log("Attempted role change data:", data);
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
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
}
