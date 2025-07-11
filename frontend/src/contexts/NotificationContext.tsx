import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type {
  Notification,
  SystemMessage,
  ChatConversation,
} from "../types/notification";

interface NotificationContextType {
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  addNotification: (
    notification: Omit<Notification, "id" | "createdAt">
  ) => void;

  // System Messages
  systemMessages: SystemMessage[];
  markSystemMessageAsRead: (messageId: string) => void;

  // Chat Conversations
  chatConversations: ChatConversation[];
  markChatAsRead: (userId: string) => void;
  sendMessage: (toUserId: string, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

// Mock data for demonstration
const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "system",
    title: "System Maintenance",
    message: "Scheduled maintenance tonight from 2:00 AM to 4:00 AM",
    isRead: false,
    createdAt: "2025-07-10T10:00:00Z",
  },
  {
    id: "2",
    type: "user_message",
    title: "New Message",
    message: "Hey, are you available for the event tomorrow?",
    isRead: false,
    createdAt: "2025-07-10T09:30:00Z",
    fromUser: {
      id: "user_2",
      firstName: "Jane",
      lastName: "Smith",
      username: "jane_smith",
      avatar: undefined,
      gender: "female",
    },
  },
  {
    id: "3",
    type: "management_action",
    title: "Role Updated",
    message: "Your role has been updated from Participant to Leader",
    isRead: true,
    createdAt: "2025-07-09T15:00:00Z",
    actionType: "promotion",
    actionDetails: {
      fromRole: "Participant",
      toRole: "Leader",
      actorName: "Admin User",
    },
  },
];

const mockSystemMessages: SystemMessage[] = [
  {
    id: "sys_1",
    title: "System Maintenance Schedule",
    content:
      "We will be performing scheduled maintenance on our servers tonight from 2:00 AM to 4:00 AM EST. During this time, the system may be temporarily unavailable. We apologize for any inconvenience.",
    type: "maintenance",
    isRead: false,
    createdAt: "2025-07-10T10:00:00Z",
    priority: "medium",
  },
  {
    id: "sys_2",
    title: "New Feature: Event Notifications",
    content:
      "We're excited to announce our new event notification system! You'll now receive real-time updates about events you're interested in.",
    type: "update",
    isRead: true,
    createdAt: "2025-07-09T12:00:00Z",
    priority: "low",
  },
];

const mockChatConversations: ChatConversation[] = [
  {
    userId: "user_2",
    user: {
      id: "user_2",
      firstName: "Jane",
      lastName: "Smith",
      username: "jane_smith",
      avatar: undefined,
      gender: "female",
    },
    lastMessage: {
      id: "msg_1",
      fromUserId: "user_2",
      toUserId: "current_user",
      message: "Hey, are you available for the event tomorrow?",
      isRead: false,
      createdAt: "2025-07-10T09:30:00Z",
    },
    unreadCount: 2,
    messages: [
      {
        id: "msg_0",
        fromUserId: "current_user",
        toUserId: "user_2",
        message: "Hi Jane! How are you doing?",
        isRead: true,
        createdAt: "2025-07-10T09:00:00Z",
      },
      {
        id: "msg_1",
        fromUserId: "user_2",
        toUserId: "current_user",
        message: "Hey, are you available for the event tomorrow?",
        isRead: false,
        createdAt: "2025-07-10T09:30:00Z",
      },
    ],
  },
];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] =
    useState<Notification[]>(mockNotifications);
  const [systemMessages, setSystemMessages] =
    useState<SystemMessage[]>(mockSystemMessages);
  const [chatConversations, setChatConversations] = useState<
    ChatConversation[]
  >(mockChatConversations);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, isRead: true }))
    );
  };

  const addNotification = (
    notification: Omit<Notification, "id" | "createdAt">
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const markSystemMessageAsRead = (messageId: string) => {
    setSystemMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, isRead: true } : message
      )
    );
  };

  const markChatAsRead = (userId: string) => {
    setChatConversations((prev) =>
      prev.map((conv) =>
        conv.userId === userId
          ? {
              ...conv,
              unreadCount: 0,
              messages: conv.messages.map((msg) => ({ ...msg, isRead: true })),
            }
          : conv
      )
    );

    // Also mark notification as read
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.type === "user_message" &&
        notification.fromUser?.id === userId
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const sendMessage = (toUserId: string, message: string) => {
    const newMessage = {
      id: Math.random().toString(36).substr(2, 9),
      fromUserId: "current_user",
      toUserId,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    setChatConversations((prev) =>
      prev.map((conv) =>
        conv.userId === toUserId
          ? {
              ...conv,
              lastMessage: newMessage,
              messages: [...conv.messages, newMessage],
            }
          : conv
      )
    );
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
        systemMessages,
        markSystemMessageAsRead,
        chatConversations,
        markChatAsRead,
        sendMessage,
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
