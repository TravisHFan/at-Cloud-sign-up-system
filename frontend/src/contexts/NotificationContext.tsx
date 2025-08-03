import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useToastReplacement } from "./NotificationModalContext";
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

// Global singleton pattern to track active WebSocket listeners
const activeListeners = new Set<string>();

// Global message ID tracking to prevent duplicate processing
const processedMessageIds = new Set<string>();

// Periodic cleanup to prevent memory bloat
setInterval(() => {
  if (processedMessageIds.size > 1000) {
    console.log(
      "🧹 [CLEANUP] Clearing processed message IDs to prevent memory bloat"
    );
    processedMessageIds.clear();
  }
}, 300000); // Clean every 5 minutes

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const notification = useToastReplacement();
  const { currentUser } = useAuth();
  const socket = useSocket();

  // Ref to prevent React StrictMode double execution
  const listenersSetupRef = useRef(false);

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

  // 🚀 POLLING REMOVED: WebSocket handles all real-time updates
  // The setInterval polling has been completely removed since WebSocket
  // provides instant updates for all notification and system message changes

  // Real-time WebSocket listeners for instant updates
  useEffect(() => {
    if (!currentUser || !socket?.socket) return;

    const listenerId = Math.random().toString(36).substr(2, 9);
    const userSocketKey = `${currentUser.id}-${socket.socket.id || "default"}`;

    // Check if listeners are already active for this user-socket combination
    if (activeListeners.has(userSocketKey)) {
      console.log(
        "🔄 [DEBUG] WebSocket listeners already active for:",
        userSocketKey,
        "Skipping setup"
      );
      return;
    }

    // Double-check with ref to prevent React StrictMode double execution
    if (listenersSetupRef.current) {
      console.log(
        "🔄 [DEBUG] Listeners already setup for this component instance, skipping"
      );
      return;
    }

    // Mark this user-socket combination as having active listeners
    activeListeners.add(userSocketKey);
    listenersSetupRef.current = true;

    console.log(
      "🔧 [DEBUG] Setting up WebSocket listeners for user:",
      currentUser.id,
      "Listener ID:",
      listenerId,
      "Key:",
      userSocketKey
    );

    const handleSystemMessageUpdate = (update: any) => {
      console.log(
        "🔍 [DEBUG] Received system_message_update (Listener:",
        listenerId,
        "):",
        update
      );
      switch (update.event) {
        case "message_created":
          const messageId = update.data.message.id;
          const processKey = `system_${messageId}`;

          // Check if this message has already been processed globally
          if (processedMessageIds.has(processKey)) {
            console.log(
              "🔄 [GLOBAL] Skipping already processed system message:",
              update.data.message.title,
              "ID:",
              messageId
            );
            return;
          }

          // Mark this message as processed globally
          processedMessageIds.add(processKey);

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
          };

          setSystemMessages((prev) => {
            // Double-check if message already exists to avoid duplicates
            const exists = prev.some((msg) => msg.id === newMessage.id);
            if (exists) {
              console.log(
                "🔄 [LOCAL] System message already exists in state:",
                newMessage.title,
                "ID:",
                newMessage.id
              );
              return prev;
            }

            const updatedMessages = [newMessage, ...prev];
            console.log(
              "✅ [GLOBAL] Added new system message:",
              newMessage.title,
              "ID:",
              newMessage.id,
              "Total messages:",
              updatedMessages.length
            );
            return updatedMessages;
          });

          // Show notification for new messages (but don't add to bell notifications here)
          // The bell notification will be handled by the bell_notification_update event
          notification.info(
            `New ${update.data.message.type}: ${update.data.message.title}`,
            {
              title: "System Message",
              autoCloseDelay: 5000,
            }
          );

          // ✅ NEW: Handle bell notification creation from system message
          // Since we have unified architecture, system messages automatically become bell notifications
          const bellNotificationId = messageId;
          const bellProcessKey = `bell_${bellNotificationId}`;

          // Check if this bell notification has already been processed globally
          if (!processedMessageIds.has(bellProcessKey)) {
            // Mark this bell notification as processed globally
            processedMessageIds.add(bellProcessKey);

            // Create bell notification from system message data
            const bellNotification: Notification = {
              id: bellNotificationId,
              type: "SYSTEM_MESSAGE" as const,
              title: newMessage.title,
              message: newMessage.content,
              isRead: false,
              createdAt: newMessage.createdAt,
              userId: "", // Not needed for system messages
              systemMessage: {
                id: bellNotificationId,
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
            };

            setNotifications((prev) => {
              // Double-check if notification already exists to avoid duplicates
              const exists = prev.some(
                (notif) => notif.id === bellNotification.id
              );
              if (exists) {
                console.log(
                  "🔄 [LOCAL] Bell notification already exists in state:",
                  bellNotification.title,
                  "ID:",
                  bellNotification.id
                );
                return prev;
              }

              const updatedNotifications = [bellNotification, ...prev];
              console.log(
                "✅ [UNIFIED] Created bell notification from system message:",
                bellNotification.title,
                "ID:",
                bellNotification.id,
                "Total notifications:",
                updatedNotifications.length
              );
              return updatedNotifications;
            });
          } else {
            console.log(
              "🔄 [GLOBAL] Skipping already processed bell notification (from system message):",
              newMessage.title,
              "ID:",
              bellNotificationId
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
      console.log(
        "🔍 [DEBUG] Received bell_notification_update (Listener:",
        listenerId,
        "):",
        update
      );

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
        default:
          console.log(
            "🔄 [UNIFIED] Bell notification creation now handled by system_message_update:",
            update.event
          );
          break;
      }
    };
    const handleUnreadCountUpdate = async () => {
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

    // Add event listeners - only once per socket connection
    const socketInstance = socket.socket;

    // Remove any existing listeners first to prevent duplicates
    socketInstance.off("system_message_update");
    socketInstance.off("bell_notification_update");
    socketInstance.off("unread_count_update");

    socketInstance.on("system_message_update", handleSystemMessageUpdate);
    socketInstance.on("bell_notification_update", handleBellNotificationUpdate);
    socketInstance.on("unread_count_update", handleUnreadCountUpdate);

    console.log(
      "✅ [DEBUG] WebSocket listeners registered successfully (Listener:",
      listenerId,
      ") | Active listeners:",
      activeListeners.size,
      "| Processed messages:",
      processedMessageIds.size
    );

    // Cleanup on unmount or dependency change
    return () => {
      console.log(
        "🧹 [DEBUG] Cleaning up WebSocket listeners (Listener:",
        listenerId,
        "Key:",
        userSocketKey,
        ")"
      );

      // Remove from active listeners set
      activeListeners.delete(userSocketKey);
      listenersSetupRef.current = false;

      socketInstance.off("system_message_update", handleSystemMessageUpdate);
      socketInstance.off(
        "bell_notification_update",
        handleBellNotificationUpdate
      );
      socketInstance.off("unread_count_update", handleUnreadCountUpdate);
    };
  }, [currentUser?.id, socket?.connected]); // Use socket.connected instead of socket.socket

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
