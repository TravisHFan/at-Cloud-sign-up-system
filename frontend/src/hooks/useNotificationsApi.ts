import { useState, useEffect, useCallback } from "react";
import { notificationService } from "../services/api";
import toast from "react-hot-toast";

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error" | "event" | "system";
  title: string;
  message: string;
  read: boolean;
  userId: string;
  eventId?: string;
  actionUrl?: string;
  actionText?: string;
  priority: "low" | "medium" | "high";
  createdAt: string;
  expiresAt?: string;
  metadata?: {
    eventTitle?: string;
    eventDate?: string;
    eventType?: string;
    actionRequired?: boolean;
    relatedUser?: string;
  };
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const backendNotifications = await notificationService.getNotifications();

      // Convert backend notification format to frontend Notification format
      const convertedNotifications: Notification[] = backendNotifications.map(
        (notification: any) => ({
          id: notification.id || notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: notification.read || false,
          userId: notification.userId,
          eventId: notification.eventId,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
          priority: notification.priority || "medium",
          createdAt: notification.createdAt,
          expiresAt: notification.expiresAt,
          metadata: notification.metadata || {},
        })
      );

      setNotifications(convertedNotifications);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load notifications";
      setError(errorMessage);
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (err: any) {
      const errorMessage = err.message || "Failed to mark notification as read";
      toast.error(errorMessage);
      console.error("Error marking notification as read:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, read: true }))
      );

      toast.success("All notifications marked as read");
    } catch (err: any) {
      const errorMessage =
        err.message || "Failed to mark all notifications as read";
      toast.error(errorMessage);
      console.error("Error marking all notifications as read:", err);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);

      // Update local state
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== notificationId)
      );
    } catch (err: any) {
      const errorMessage = err.message || "Failed to delete notification";
      toast.error(errorMessage);
      console.error("Error deleting notification:", err);
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await notificationService.clearAll();

      // Update local state
      setNotifications([]);
      toast.success("All notifications cleared");
    } catch (err: any) {
      const errorMessage = err.message || "Failed to clear notifications";
      toast.error(errorMessage);
      console.error("Error clearing notifications:", err);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Auto-load notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
}

// Hook for creating notifications (admin functionality)
export function useCreateNotification() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createNotification = useCallback(
    async (notificationData: {
      type: Notification["type"];
      title: string;
      message: string;
      userId?: string; // If not provided, sends to all users
      eventId?: string;
      actionUrl?: string;
      actionText?: string;
      priority?: Notification["priority"];
      expiresAt?: string;
      metadata?: Notification["metadata"];
    }) => {
      setLoading(true);
      setError(null);

      try {
        const notification = await notificationService.createNotification(
          notificationData
        );
        toast.success("Notification created successfully");
        return notification;
      } catch (err: any) {
        const errorMessage = err.message || "Failed to create notification";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error("Error creating notification:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    createNotification,
    loading,
    error,
  };
}

// Hook for bulk notification operations
export function useBulkNotifications() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendBulkNotification = useCallback(
    async (notificationData: {
      type: Notification["type"];
      title: string;
      message: string;
      userIds?: string[]; // If not provided, sends to all users
      roleFilter?: string; // Send to specific role
      eventId?: string;
      actionUrl?: string;
      actionText?: string;
      priority?: Notification["priority"];
      expiresAt?: string;
      metadata?: Notification["metadata"];
    }) => {
      setLoading(true);
      setError(null);

      try {
        const count = await notificationService.sendBulkNotification(
          notificationData
        );
        toast.success(`Notification sent to ${count} users`);
        return count;
      } catch (err: any) {
        const errorMessage = err.message || "Failed to send bulk notification";
        setError(errorMessage);
        toast.error(errorMessage);
        console.error("Error sending bulk notification:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    sendBulkNotification,
    loading,
    error,
  };
}

// Hook for notification settings
export function useNotificationSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const settings = await notificationService.getSettings();
      setSettings(settings || {});
    } catch (err: any) {
      const errorMessage =
        err.message || "Failed to load notification settings";
      setError(errorMessage);
      console.error("Error fetching notification settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: any) => {
    setLoading(true);
    setError(null);

    try {
      const settings = await notificationService.updateSettings(newSettings);
      setSettings(settings || {});
      toast.success("Notification settings updated");
    } catch (err: any) {
      const errorMessage =
        err.message || "Failed to update notification settings";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error updating notification settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    updateSettings,
    loading,
    error,
    refreshSettings: fetchSettings,
  };
}
