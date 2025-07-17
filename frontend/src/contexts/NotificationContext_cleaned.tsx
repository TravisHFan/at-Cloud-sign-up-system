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
import { setNotificationService } from "../utils/welcomeMessageService";
import { securityAlertService } from "../utils/securityAlertService";
import { systemMessageIntegration } from "../utils/systemMessageIntegration";
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

// Helper function to create system message creator from centralized user data
const createSystemMessageCreator = (
  userId: string,
  customRoleInAtCloud?: string
) => {
  const user = getUserById(userId);
  if (!user) {
    throw new Error(`User with ID ${userId} not found in centralized data`);
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatar: user.avatar || undefined,
    gender: user.gender,
    roleInAtCloud:
      customRoleInAtCloud || user.roleInAtCloud || `${user.role} User`,
  };
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const socket = useSocket();

  const [notifications, setNotifications] =
    useState<Notification[]>(mockNotifications);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const [lastLocalUpdate, setLastLocalUpdate] = useState<number>(0);

  // Socket.IO event listeners for real-time notifications
  useEffect(() => {
    if (!currentUser || !socket) {
      return;
    }

    const { onEventUpdate } = socket;

    // Listen for event updates
    const unsubscribeEvents = onEventUpdate((update) => {
      const newNotification: Notification = {
        id: `event-${Date.now()}-${Math.random()}`,
        type: update.type === "reminder" ? "EVENT_REMINDER" : "EVENT_UPDATE",
        title: update.eventTitle,
        message: update.message,
        createdAt: new Date().toISOString(),
        isRead: false,
        userId: currentUser.id,
        eventId: update.eventId,
      };

      setNotifications((prev) => [newNotification, ...prev]);
    });

    return () => {
      unsubscribeEvents();
    };
  }, [currentUser, socket]);

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
    setLastLocalUpdate(Date.now());
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
    message: Omit<SystemMessage, "id" | "createdAt">
  ) => {
    try {
      const savedMessage = await systemMessageService.createSystemMessage(
        message
      );
      setSystemMessages((prev) => [savedMessage, ...prev]);
      return savedMessage;
    } catch (error) {
      console.error("Failed to add system message:", error);
      toast.error("Failed to add system message");
      throw error;
    }
  };

  const addAutoSystemMessage = async (
    message: Omit<SystemMessage, "id" | "createdAt">
  ) => {
    try {
      const savedMessage = await systemMessageService.createSystemMessage({
        ...message,
        isAutoGenerated: true,
      });
      setSystemMessages((prev) => [savedMessage, ...prev]);
      return savedMessage;
    } catch (error) {
      console.error("Failed to add auto system message:", error);
      console.log("Error details:", error);
    }
  };

  const deleteSystemMessage = (messageId: string) => {
    setSystemMessages((prev) =>
      prev.filter((message) => message.id !== messageId)
    );
  };

  const addRoleChangeSystemMessage = (data: {
    targetUserName: string;
    targetUserId: string;
    fromSystemAuthLevel: string;
    toSystemAuthLevel: string;
    actorUserId: string;
    actorName: string;
  }) => {
    const message = {
      type: "ROLE_CHANGE" as const,
      title: "User Role Updated",
      content: `${data.actorName} changed ${data.targetUserName}'s system access level from ${data.fromSystemAuthLevel} to ${data.toSystemAuthLevel}.`,
      priority: "medium" as const,
      creator: createSystemMessageCreator(data.actorUserId),
      metadata: {
        actionType: "role_change",
        targetUserId: data.targetUserId,
        targetUserName: data.targetUserName,
        fromRole: data.fromSystemAuthLevel,
        toRole: data.toSystemAuthLevel,
        actorUserId: data.actorUserId,
        actorName: data.actorName,
      },
    };

    addAutoSystemMessage(message);
  };

  const getAllUsers = () => {
    return getCentralizedUsers();
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
        getUserById,
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
