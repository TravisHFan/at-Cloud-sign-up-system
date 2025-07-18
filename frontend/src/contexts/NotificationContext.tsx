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

  const [notifications, setNotifications] =
    useState<Notification[]>(mockNotifications);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);

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

  // Load system messages from backend
  useEffect(() => {
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

  const markAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      toast.error("Failed to mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, isRead: true }))
      );
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
      await systemMessageService.markAsRead(messageId);
      setSystemMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? { ...message, isRead: true } : message
        )
      );
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

  // Combine notifications and system messages for bell dropdown
  const systemMessageNotifications: Notification[] = systemMessages.map(
    (msg) => ({
      id: `system-${msg.id}`,
      type: "SYSTEM_MESSAGE",
      title: msg.title,
      message: msg.content,
      createdAt: msg.createdAt,
      isRead: msg.isRead,
      userId: currentUser?.id || "",
      systemMessage: msg,
    })
  );

  const allNotifications = [
    ...notifications.filter(
      (notification) => notification.type !== "SYSTEM_MESSAGE"
    ),
    ...systemMessageNotifications,
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const totalUnreadCount =
    unreadCount + systemMessages.filter((msg) => !msg.isRead).length;

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
