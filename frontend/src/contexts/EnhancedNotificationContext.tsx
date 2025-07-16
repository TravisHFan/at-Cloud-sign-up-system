import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Notification, SystemMessage } from "../types/notification";
import { unifiedNotificationService } from "../services/unifiedNotificationService";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";

interface EnhancedNotificationContextType {
  // Bell dropdown notifications (unified view)
  allNotifications: Notification[];
  totalUnreadCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markSystemMessageAsRead: (messageId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;

  // System messages (for dedicated page)
  systemMessages: SystemMessage[];
  addSystemMessage: (message: {
    title: string;
    content: string;
    type:
      | "announcement"
      | "maintenance"
      | "update"
      | "warning"
      | "auth_level_change";
    priority?: "high" | "medium" | "low";
  }) => Promise<void>;
  deleteSystemMessage: (messageId: string) => Promise<void>;
}

const EnhancedNotificationContext = createContext<
  EnhancedNotificationContextType | undefined
>(undefined);

export const useEnhancedNotifications = () => {
  const context = useContext(EnhancedNotificationContext);
  if (context === undefined) {
    throw new Error(
      "useEnhancedNotifications must be used within an EnhancedNotificationProvider"
    );
  }
  return context;
};

interface Props {
  children: ReactNode;
}

export const EnhancedNotificationProvider: React.FC<Props> = ({ children }) => {
  const { currentUser } = useAuth();
  const socket = useSocket();

  // State management
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load notifications from backend on mount and user change
  useEffect(() => {
    if (currentUser) {
      loadInitialData();
    } else {
      // Clear data when user logs out
      setAllNotifications([]);
      setSystemMessages([]);
      setTotalUnreadCount(0);
    }
  }, [currentUser]);

  // Set up real-time Socket.IO listeners
  useEffect(() => {
    if (!socket?.socket || !currentUser) return;

    const socketInstance = socket.socket;

    // Listen for new notifications
    const handleNewNotification = (notification: any) => {
      console.log("🔔 Received new notification via socket:", notification);

      // Convert to our notification format
      const formattedNotification: Notification = {
        id: notification.id || notification._id,
        type: notification.type || "system",
        title: notification.title,
        message: notification.message || notification.content,
        isRead: notification.isRead || false,
        createdAt: notification.createdAt || new Date().toISOString(),
        priority: notification.priority || "medium",
        systemMessage: notification.systemMessage,
        fromUser: notification.fromUser,
        actionType: notification.actionType,
        actionDetails: notification.actionDetails,
      };

      // Add to notifications list (at the beginning)
      setAllNotifications((prev) => [formattedNotification, ...prev]);

      // Update unread count
      if (!formattedNotification.isRead) {
        setTotalUnreadCount((prev) => prev + 1);
      }
    };

    // Listen for notification updates
    const handleNotificationUpdate = (update: {
      notificationId: string;
      isRead?: boolean;
      deleted?: boolean;
    }) => {
      console.log("📝 Received notification update via socket:", update);

      if (update.deleted) {
        // Remove notification
        setAllNotifications((prev) =>
          prev.filter((n) => n.id !== update.notificationId)
        );
        setTotalUnreadCount((prev) => Math.max(0, prev - 1));
      } else if (update.isRead !== undefined) {
        // Update read status
        setAllNotifications((prev) =>
          prev.map((n) =>
            n.id === update.notificationId
              ? { ...n, isRead: update.isRead! }
              : n
          )
        );

        if (update.isRead) {
          setTotalUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    };

    // Listen for system message updates
    const handleSystemMessageUpdate = (update: any) => {
      console.log("📝 Received system message update via socket:", update);

      if (update.type === "new") {
        setSystemMessages((prev) => [update.systemMessage, ...prev]);
      } else if (update.type === "deleted") {
        setSystemMessages((prev) =>
          prev.filter((m) => m.id !== update.messageId)
        );
        // Also remove from bell notifications
        setAllNotifications((prev) =>
          prev.filter(
            (n) =>
              n.systemMessage?.id !== update.messageId &&
              n.id !== update.messageId
          )
        );
      }
    };

    // Add event listeners
    socketInstance.on("new_notification", handleNewNotification);
    socketInstance.on("notification_update", handleNotificationUpdate);
    socketInstance.on("system_message_update", handleSystemMessageUpdate);

    return () => {
      socketInstance.off("new_notification", handleNewNotification);
      socketInstance.off("notification_update", handleNotificationUpdate);
      socketInstance.off("system_message_update", handleSystemMessageUpdate);
    };
  }, [socket, currentUser]);

  const loadInitialData = async () => {
    if (!currentUser) return;

    setIsLoading(true);
    setError(null);

    try {
      // Load unified notifications for bell dropdown
      const notificationResult =
        await unifiedNotificationService.getUnifiedNotifications({
          page: 1,
          limit: 100, // Load more for initial load
          includeRead: true,
        });

      setAllNotifications(notificationResult.notifications);
      setTotalUnreadCount(notificationResult.unreadCount);

      // Load system messages for dedicated page
      const systemMessageResult =
        await unifiedNotificationService.getSystemMessages({
          page: 1,
          limit: 100,
        });

      setSystemMessages(systemMessageResult.systemMessages);

      console.log("✅ Loaded notifications and system messages from backend");
    } catch (error) {
      console.error("❌ Failed to load initial notification data:", error);
      setError("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshNotifications = async () => {
    await loadInitialData();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Optimistic update
      setAllNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setTotalUnreadCount((prev) => Math.max(0, prev - 1));

      // Persist to backend
      await unifiedNotificationService.markNotificationAsRead(notificationId);

      console.log("✅ Marked notification as read:", notificationId);
    } catch (error) {
      console.error("❌ Failed to mark notification as read:", error);
      // Revert optimistic update on error
      await refreshNotifications();
    }
  };

  const markSystemMessageAsRead = async (messageId: string) => {
    try {
      // Optimistic update for system messages
      setSystemMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isRead: true } : m))
      );

      // Also update if it's in the bell notifications
      setAllNotifications((prev) =>
        prev.map((n) =>
          n.systemMessage?.id === messageId || n.id === messageId
            ? { ...n, isRead: true }
            : n
        )
      );

      setTotalUnreadCount((prev) => Math.max(0, prev - 1));

      // Persist to backend
      await unifiedNotificationService.markSystemMessageAsRead(messageId);

      console.log("✅ Marked system message as read:", messageId);
    } catch (error) {
      console.error("❌ Failed to mark system message as read:", error);
      // Revert optimistic update on error
      await refreshNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      // Optimistic update
      setAllNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setSystemMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
      setTotalUnreadCount(0);

      // Persist to backend
      await unifiedNotificationService.markAllNotificationsAsRead();

      console.log("✅ Marked all notifications as read");
    } catch (error) {
      console.error("❌ Failed to mark all notifications as read:", error);
      // Revert optimistic update on error
      await refreshNotifications();
    }
  };

  const removeNotification = async (notificationId: string) => {
    try {
      // Optimistic update
      const notificationToRemove = allNotifications.find(
        (n) => n.id === notificationId
      );
      setAllNotifications((prev) =>
        prev.filter((n) => n.id !== notificationId)
      );

      if (notificationToRemove && !notificationToRemove.isRead) {
        setTotalUnreadCount((prev) => Math.max(0, prev - 1));
      }

      // Persist to backend
      await unifiedNotificationService.deleteNotification(notificationId);

      console.log("✅ Removed notification:", notificationId);
    } catch (error) {
      console.error("❌ Failed to remove notification:", error);
      // Revert optimistic update on error
      await refreshNotifications();
    }
  };

  const addSystemMessage = async (message: {
    title: string;
    content: string;
    type:
      | "announcement"
      | "maintenance"
      | "update"
      | "warning"
      | "auth_level_change";
    priority?: "high" | "medium" | "low";
  }) => {
    try {
      // Create system message via backend
      const result = await unifiedNotificationService.createSystemMessage(
        message
      );

      // Update local state with the new system message
      setSystemMessages((prev) => [result.systemMessage, ...prev]);

      // Add any new notifications to the bell dropdown
      if (result.notifications && result.notifications.length > 0) {
        setAllNotifications((prev) => [...result.notifications, ...prev]);
        const unreadCount = result.notifications.filter(
          (n) => !n.isRead
        ).length;
        setTotalUnreadCount((prev) => prev + unreadCount);
      }

      console.log("✅ Created system message successfully");
    } catch (error) {
      console.error("❌ Failed to create system message:", error);
      throw error; // Re-throw for UI error handling
    }
  };

  const deleteSystemMessage = async (messageId: string) => {
    try {
      // Optimistic update
      setSystemMessages((prev) => prev.filter((m) => m.id !== messageId));

      // Also remove from bell notifications if present
      setAllNotifications((prev) =>
        prev.filter(
          (n) => n.systemMessage?.id !== messageId && n.id !== messageId
        )
      );

      // Persist to backend
      await unifiedNotificationService.deleteSystemMessage(messageId);

      console.log("✅ Deleted system message:", messageId);
    } catch (error) {
      console.error("❌ Failed to delete system message:", error);
      // Revert optimistic update on error
      await refreshNotifications();
    }
  };

  const value: EnhancedNotificationContextType = {
    allNotifications,
    totalUnreadCount,
    isLoading,
    error,
    markAsRead,
    markSystemMessageAsRead,
    markAllAsRead,
    removeNotification,
    refreshNotifications,
    systemMessages,
    addSystemMessage,
    deleteSystemMessage,
  };

  return (
    <EnhancedNotificationContext.Provider value={value}>
      {children}
    </EnhancedNotificationContext.Provider>
  );
};

export default EnhancedNotificationProvider;
